import { Router } from 'express';
import mongoose from 'mongoose';
import { collections, collectionNames } from '../models/index.js';
import { requireAuth, requireUser } from '../middleware/auth.js';
import { badRequest, notFound, sanitizePayload } from '../utils/http.js';
import { cascadeDelete } from '../utils/cascade.js';
import { createOwnershipChecker } from '../utils/ownership.js';

const router = Router();
// Every route: signed-in, active user account. Every query below is scoped to req.userId,
// so records of other users are invisible (404) no matter which id is requested.
router.use(requireAuth, requireUser);

const MAX_BULK = 500;

function modelFor(req) {
  const Model = Object.hasOwn(collections, req.params.collection) ? collections[req.params.collection] : null;
  if (!Model) throw notFound(`Unknown collection "${req.params.collection}"`);
  return Model;
}

function assertId(id) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid id');
  return id;
}

function bodyObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Expected a JSON object');
  return sanitizePayload(body);
}

/** Everything the signed-in user owns, in one round trip. */
router.get('/', async (req, res) => {
  const entries = await Promise.all(
    collectionNames.map(async (name) => {
      const docs = await collections[name].find({ userId: req.userId }).sort({ createdAt: 1 });
      return [name, docs.map((d) => d.toJSON())];
    })
  );
  res.json(Object.fromEntries(entries));
});

router.get('/:collection', async (req, res) => {
  const Model = modelFor(req);
  const docs = await Model.find({ userId: req.userId }).sort({ createdAt: 1 });
  res.json(docs.map((d) => d.toJSON()));
});

router.post('/:collection', async (req, res) => {
  const Model = modelFor(req);
  const payload = await createOwnershipChecker(req.userId)(req.params.collection, bodyObject(req.body));
  const doc = await Model.create({ ...payload, userId: req.userId });
  res.status(201).json(doc.toJSON());
});

router.post('/:collection/bulk', async (req, res) => {
  const Model = modelFor(req);
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items) throw badRequest('Expected { items: [...] }');
  if (items.length > MAX_BULK) throw badRequest(`At most ${MAX_BULK} records per request`);
  const check = createOwnershipChecker(req.userId);
  const payloads = [];
  for (const it of items) payloads.push(await check(req.params.collection, bodyObject(it)));
  const docs = await Model.insertMany(payloads.map((p) => ({ ...p, userId: req.userId })));
  res.status(201).json(docs.map((d) => d.toJSON()));
});

router.put('/:collection/:id', async (req, res) => {
  const Model = modelFor(req);
  const id = assertId(req.params.id);
  const doc = await Model.findOne({ _id: id, userId: req.userId });
  if (!doc) throw notFound('Record not found');
  const patch = await createOwnershipChecker(req.userId)(req.params.collection, bodyObject(req.body));
  for (const [key, value] of Object.entries(patch)) {
    doc.set(key, value);
    if (Model.schema.path(key)?.instance === 'Mixed') doc.markModified(key);
  }
  await doc.save();
  res.json(doc.toJSON());
});

router.delete('/:collection/:id', async (req, res) => {
  modelFor(req);
  const id = assertId(req.params.id);
  const exists = await collections[req.params.collection].exists({ _id: id, userId: req.userId });
  if (!exists) throw notFound('Record not found');
  res.json(await cascadeDelete(req.userId, req.params.collection, id));
});

export default router;

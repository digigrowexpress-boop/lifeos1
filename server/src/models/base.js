import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Fields every user-owned record carries. */
export const ownerField = {
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
};

/** Standard JSON shape returned to the client: `id` instead of `_id`, no internals. */
export function cleanJSON(schema) {
  schema.set('toJSON', {
    virtuals: false,
    versionKey: false,
    transform(_doc, ret) {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.userId;
      return ret;
    },
  });
}

/** Build a user-owned schema with timestamps and a clean JSON transform. */
export function ownedSchema(definition, options = {}) {
  const schema = new Schema({ ...ownerField, ...definition }, { timestamps: true, minimize: false, ...options });
  cleanJSON(schema);
  return schema;
}

export const str = (extra = {}) => ({ type: String, trim: true, default: '', ...extra });
export const num = (extra = {}) => ({ type: Number, default: null, ...extra });
export const ref = () => ({ type: String, default: null, index: true });
export const isoDate = () => ({ type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ });

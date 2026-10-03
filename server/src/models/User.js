import mongoose from 'mongoose';

export const ROLES = ['user', 'admin'];
export const STATUSES = ['pending', 'active', 'rejected', 'suspended'];

/** One entry per account-status change, for the admin's registration history. */
const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = the user / system
    note: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    // bcrypt hash only — the plaintext password is never stored or returned.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'user', index: true },
    status: { type: String, enum: STATUSES, default: 'pending', index: true },
    statusHistory: { type: [statusEventSchema], default: [] },
    approvedAt: { type: Date, default: null },
    // Profile, university configuration, grading rules and preferences.
    // Stored as a flexible document because every university is configured differently.
    profile: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false }
);

userSchema.set('toJSON', {
  versionKey: false,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.passwordHash;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 3, maxlength: 50, unique: true },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, unique: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

const emergencyContactSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  relationship: { type: String, trim: true, maxlength: 50, default: '' },
}, { timestamps: true });

const sosAlertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  latitude: { type: Number, min: -90, max: 90, default: null },
  longitude: { type: Number, min: -180, max: 180, default: null },
  message: { type: String, maxlength: 255, default: 'Emergency SOS alert' },
  status: { type: String, enum: ['created', 'resolved'], default: 'created' },
}, { timestamps: true });

sosAlertSchema.index({ userId: 1, createdAt: -1 });
emergencyContactSchema.index({ userId: 1, createdAt: -1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const EmergencyContact = mongoose.models.EmergencyContact || mongoose.model('EmergencyContact', emergencyContactSchema);
export const SOSAlert = mongoose.models.SOSAlert || mongoose.model('SOSAlert', sosAlertSchema);

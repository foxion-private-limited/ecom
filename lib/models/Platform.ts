import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPlatform extends Document {
  name: string;
  code: string;
  defaultCommissionPercentage: number;
  isActive: boolean;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSchema = new Schema<IPlatform>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    defaultCommissionPercentage: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    color: { type: String, default: "#3b82f6" },
  },
  { timestamps: true }
);

export const Platform: Model<IPlatform> =
  mongoose.models.Platform ||
  mongoose.model<IPlatform>("Platform", PlatformSchema);
export default Platform;

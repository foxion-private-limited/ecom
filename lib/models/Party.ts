import mongoose, { Schema, Document, Model } from "mongoose";

export type PartyType = "CUSTOMER" | "SUPPLIER" | "MARKETPLACE" | "OTHER";

export interface IParty extends Document {
  name: string;
  type: PartyType;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PartySchema = new Schema<IParty>(
  {
    name: { type: String, required: true, trim: true, index: true },
    type: {
      type: String,
      enum: ["CUSTOMER", "SUPPLIER", "MARKETPLACE", "OTHER"],
      required: true,
      default: "OTHER",
      index: true,
    },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Party: Model<IParty> =
  mongoose.models.Party || mongoose.model<IParty>("Party", PartySchema);
export default Party;

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IImportBatch extends Document {
  batchId: string;
  filename: string;
  accountType: "MAIN" | "ECOMMERCE";
  totalRows: number;
  validRows: number;
  importedRows: number;
  warningCount: number;
  errorCount: number;
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  importedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ImportBatchSchema = new Schema<IImportBatch>(
  {
    batchId: { type: String, required: true, unique: true, index: true },
    filename: { type: String, required: true },
    accountType: {
      type: String,
      enum: ["MAIN", "ECOMMERCE"],
      required: true,
      index: true,
    },
    totalRows: { type: Number, required: true },
    validRows: { type: Number, required: true },
    importedRows: { type: Number, required: true },
    warningCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["COMPLETED", "PARTIAL", "FAILED"],
      default: "COMPLETED",
    },
    importedBy: { type: String, default: "System" },
  },
  { timestamps: true }
);

export const ImportBatch: Model<IImportBatch> =
  mongoose.models.ImportBatch ||
  mongoose.model<IImportBatch>("ImportBatch", ImportBatchSchema);
export default ImportBatch;

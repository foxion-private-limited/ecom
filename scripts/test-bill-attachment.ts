import assert from "assert";
import mongoose from "mongoose";
import { Transaction } from "../lib/models/Transaction";
import { Bill } from "../lib/models/Bill";
import {
  createTransaction,
  updateTransaction,
  getTransactions,
  getLiquidBalances,
  deleteTransactionPermanently,
} from "../lib/services/transactionService";
import {
  validateBillBuffer,
  uploadBillToGridFS,
  getBillFromGridFS,
  deleteBillFromGridFS,
  isBillReferencedByOtherTransactions,
} from "../lib/services/billStorageService";
import { connectDB } from "../lib/db/connection";
import { POST as transactionsPOST } from "../app/api/transactions/route";
import {
  PATCH as transactionPATCH,
  DELETE as transactionDELETE,
} from "../app/api/transactions/[id]/route";
import { GET as billGET } from "../app/api/transactions/bills/[id]/route";

async function setup() {
  await connectDB();
}

async function teardown() {
  await mongoose.disconnect();
  const mem = (global as { mongooseCache?: { memoryServer?: { stop: () => Promise<boolean> } } }).mongooseCache?.memoryServer;
  if (mem && typeof mem.stop === "function") {
    await mem.stop();
  }
}

// Helper to create mock binary buffers
function createMockJpegBuffer(): Buffer {
  // JPEG starts with FF D8 FF
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
}

function createMockPngBuffer(): Buffer {
  // PNG starts with 89 50 4E 47 0D 0A 1A 0A
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
}

function createMockPdfBuffer(): Buffer {
  // PDF starts with %PDF-
  return Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF");
}

function createMockWebpBuffer(): Buffer {
  // RIFF .... WEBP
  const buf = Buffer.alloc(16);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(8, 4);
  buf.write("WEBP", 8);
  buf.write("VP8 ", 12);
  return buf;
}

function createFakeTextBuffer(): Buffer {
  return Buffer.from("Hello world, this is a plain text file, not an image or PDF.");
}

async function runAllTests() {
  console.log("🧪 Starting Foxion Bill Attachment Feature Test Suite...\n");
  await setup();

  try {
    await Transaction.deleteMany({});
    await Bill.deleteMany({});

    // --------------------------------------------------------------------------
    // Test 1: Add a Debit transaction without an attachment — must succeed
    // --------------------------------------------------------------------------
    console.log("▶ Test 1: Add a Debit transaction without an attachment");
    {
      const tx = await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: new Date("2026-04-01T10:00:00Z"),
        description: "Office Stationery",
        category: "Office Setup",
        debit: 1500,
        credit: 0,
        paymentMode: "UPI",
        bankOrCash: "Bank",
      });

      assert.ok(tx._id, "Transaction should be created");
      assert.strictEqual(tx.debit, 1500);
      assert.strictEqual(tx.billAvailable, false);
      assert.strictEqual(tx.attachment, undefined);
      console.log("   ✅ Debit transaction created successfully without attachment.");
    }

    // --------------------------------------------------------------------------
    // Test 2: Add a Debit transaction with a JPG/PNG bill — must succeed
    // --------------------------------------------------------------------------
    console.log("▶ Test 2: Add a Debit transaction with a JPG / PNG bill");
    {
      const jpegBuf = createMockJpegBuffer();
      const validation = validateBillBuffer(jpegBuf);
      assert.strictEqual(validation.isValid, true);
      assert.strictEqual(validation.contentType, "image/jpeg");

      const stored = await uploadBillToGridFS({
        buffer: jpegBuf,
        filename: "hardware_bill.jpg",
        contentType: "image/jpeg",
      });

      assert.ok(stored.fileId, "GridFS fileId should be generated");
      assert.strictEqual(stored.mimeType, "image/jpeg");

      const tx = await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: new Date("2026-04-02T10:00:00Z"),
        description: "Laptop Purchase",
        category: "Equipment",
        debit: 45000,
        credit: 0,
        paymentMode: "Bank Transfer",
        bankOrCash: "Bank",
        attachment: {
          fileId: stored.fileId,
          url: stored.url,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          size: stored.size,
        },
      });

      assert.ok(tx._id);
      assert.strictEqual(tx.billAvailable, true);
      assert.ok(tx.attachment);
      assert.strictEqual(tx.attachment.originalName, "hardware_bill.jpg");
      assert.strictEqual(tx.attachment.mimeType, "image/jpeg");
      console.log("   ✅ Debit transaction with JPG bill created and linked to GridFS.");
    }

    // --------------------------------------------------------------------------
    // Test 3: Add a Debit transaction with a PDF bill — must succeed
    // --------------------------------------------------------------------------
    console.log("▶ Test 3: Add a Debit transaction with a PDF bill");
    {
      const pdfBuf = createMockPdfBuffer();
      const validation = validateBillBuffer(pdfBuf);
      assert.strictEqual(validation.isValid, true);
      assert.strictEqual(validation.contentType, "application/pdf");

      const stored = await uploadBillToGridFS({
        buffer: pdfBuf,
        filename: "bizpole_consultancy.pdf",
        contentType: "application/pdf",
      });

      const tx = await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: new Date("2026-04-03T10:00:00Z"),
        description: "Legal Registration Fees",
        category: "Professional Fees",
        debit: 12000,
        credit: 0,
        paymentMode: "Bank Transfer",
        bankOrCash: "Bank",
        attachment: {
          fileId: stored.fileId,
          url: stored.url,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          size: stored.size,
        },
      });

      assert.ok(tx._id);
      assert.strictEqual(tx.billAvailable, true);
      assert.strictEqual(tx.attachment?.originalName, "bizpole_consultancy.pdf");
      assert.strictEqual(tx.attachment?.mimeType, "application/pdf");
      console.log("   ✅ Debit transaction with PDF bill created successfully.");
    }

    // --------------------------------------------------------------------------
    // Test 4 & 5: Attempt to submit an attachment for a Credit transaction through API
    // --------------------------------------------------------------------------
    console.log("▶ Test 4 & 5: Attempt to submit attachment for a Credit transaction -> must be rejected");
    {
      // A. Through createTransaction service
      let serviceThrew = false;
      try {
        await createTransaction({
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: new Date("2026-04-04T10:00:00Z"),
          description: "Customer Payment",
          category: "Sales",
          debit: 0,
          credit: 25000,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
          attachment: {
            url: "/api/transactions/bills/mock123",
            originalName: "receipt.jpg",
            mimeType: "image/jpeg",
            size: 1024,
          },
        });
      } catch (err: unknown) {
        serviceThrew = true;
        const msg = err instanceof Error ? err.message : String(err);
        assert.ok(msg.includes("Debit transactions"), "Error should specify Debit transactions only");
      }
      assert.strictEqual(serviceThrew, true, "Service should reject attachment for Credit transaction");

      // B. Through POST API route with multipart/form-data
      const formData = new FormData();
      formData.append(
        "payload",
        JSON.stringify({
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: "2026-04-05",
          description: "Investor Inflow",
          category: "Capital",
          debit: 0,
          credit: 100000,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
        })
      );
      const fakePdf = new File([new Uint8Array(createMockPdfBuffer())], "receipt.pdf", {
        type: "application/pdf",
      });
      formData.append("billFile", fakePdf);

      const req = new Request("http://localhost:3000/api/transactions", {
        method: "POST",
        body: formData,
      });

      const res = await transactionsPOST(req);
      assert.strictEqual(res.status, 400, "API should return 400 Bad Request");
      const data = await res.json();
      assert.ok(data.error.includes("Debit transactions"));
      console.log("   ✅ Credit transactions with attachments correctly rejected on both service and API levels.");
    }

    // --------------------------------------------------------------------------
    // Test 6: Upload an unsupported file type — must be rejected
    // --------------------------------------------------------------------------
    console.log("▶ Test 6: Upload an unsupported file type — must be rejected");
    {
      const textBuf = createFakeTextBuffer();
      const val = validateBillBuffer(textBuf);
      assert.strictEqual(val.isValid, false);
      assert.ok(val.error?.includes("Supported formats"));

      // Also test spoofed extension (e.g. text file renamed as .jpg)
      const fakeJpg = new File([new Uint8Array(textBuf)], "fake_image.jpg", {
        type: "image/jpeg",
      });
      const formData = new FormData();
      formData.append(
        "payload",
        JSON.stringify({
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: "2026-04-06",
          description: "Fraudulent Receipt Test",
          category: "Office Setup",
          debit: 500,
          credit: 0,
          paymentMode: "Cash",
          bankOrCash: "Cash",
        })
      );
      formData.append("billFile", fakeJpg);

      const req = new Request("http://localhost:3000/api/transactions", {
        method: "POST",
        body: formData,
      });

      const res = await transactionsPOST(req);
      assert.strictEqual(res.status, 400, "Spoofed file must be rejected with 400");
      const json = await res.json();
      assert.ok(json.error.includes("Invalid file format"));
      console.log("   ✅ Unsupported and spoofed files correctly rejected via magic byte inspection.");
    }

    // --------------------------------------------------------------------------
    // Test 7: Upload a file larger than 5 MB — must be rejected
    // --------------------------------------------------------------------------
    console.log("▶ Test 7: Upload a file larger than 5 MB — must be rejected");
    {
      const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024); // 5 MB + 1 KB
      largeBuffer[0] = 0xff;
      largeBuffer[1] = 0xd8;
      largeBuffer[2] = 0xff; // Starts with valid JPEG header

      const val = validateBillBuffer(largeBuffer);
      assert.strictEqual(val.isValid, false);
      assert.ok(val.error?.includes("5 MB limit"));
      console.log("   ✅ Files exceeding 5 MB limit correctly rejected.");
    }

    // --------------------------------------------------------------------------
    // Test 8: Remove a selected attachment before submitting — transaction created without file
    // --------------------------------------------------------------------------
    console.log("▶ Test 8: Transaction submitted without file after removal");
    {
      const formData = new FormData();
      formData.append(
        "payload",
        JSON.stringify({
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: "2026-04-07",
          description: "Clean Debit Without File",
          category: "Domain / Hosting",
          debit: 2000,
          credit: 0,
          paymentMode: "UPI",
          bankOrCash: "Bank",
        })
      );
      // No billFile appended

      const req = new Request("http://localhost:3000/api/transactions", {
        method: "POST",
        body: formData,
      });

      const res = await transactionsPOST(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.transaction.billAvailable, false);
      assert.strictEqual(json.transaction.attachment, undefined);
      console.log("   ✅ Transaction created cleanly without attachment.");
    }

    // --------------------------------------------------------------------------
    // Test 9: View a transaction with an attachment — file must open correctly
    // --------------------------------------------------------------------------
    console.log("▶ Test 9: View a transaction with an attachment — file must open correctly");
    {
      const pdfBuf = createMockPdfBuffer();
      const stored = await uploadBillToGridFS({
        buffer: pdfBuf,
        filename: "tax_invoice_doc.pdf",
        contentType: "application/pdf",
      });

      const retrieved = await getBillFromGridFS(stored.fileId);
      assert.ok(retrieved);
      assert.strictEqual(retrieved.contentType, "application/pdf");
      assert.strictEqual(retrieved.length, pdfBuf.length);

      // Test the API GET route
      const req = new Request(`http://localhost:3000/api/transactions/bills/${stored.fileId.toString()}`);
      const res = await billGET(req, {
        params: Promise.resolve({ id: stored.fileId.toString() }),
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get("Content-Type"), "application/pdf");
      assert.ok(res.headers.get("Content-Disposition")?.includes("inline"));
      console.log("   ✅ Bill file retrieved and streamed with proper HTTP headers.");
    }

    // --------------------------------------------------------------------------
    // Test 10: View older transactions without an attachment — no errors
    // --------------------------------------------------------------------------
    console.log("▶ Test 10: View older transactions without an attachment — no errors");
    {
      const result = await getTransactions({ accountType: "MAIN" });
      assert.ok(result.transactions.length > 0);
      for (const t of result.transactions) {
        // Must not crash on older records without attachments
        if (!t.attachment) {
          assert.strictEqual(t.attachment, undefined);
        }
      }
      console.log("   ✅ Querying transactions without attachments completes smoothly.");
    }

    // --------------------------------------------------------------------------
    // Test 11: Rollback on failure — clean up uploaded file from GridFS
    // --------------------------------------------------------------------------
    console.log("▶ Test 11: Rollback on transaction failure -> clean up uploaded GridFS file");
    {
      // Create an existing transaction on 2026-04-10
      await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: new Date("2026-04-10T10:00:00Z"),
        description: "Existing Date Conflict Baseline",
        category: "Office Setup",
        debit: 100,
        credit: 0,
        paymentMode: "Cash",
        bankOrCash: "Cash",
      });

      // Attempt to submit a new transaction on the same date with an attachment
      // (This causes duplicate date conflict error 409 in createTransaction)
      const pngBuf = createMockPngBuffer();
      const fakePng = new File([new Uint8Array(pngBuf)], "receipt.png", { type: "image/png" });

      const formData = new FormData();
      formData.append(
        "payload",
        JSON.stringify({
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: "2026-04-10", // Exact same date!
          description: "Conflict Attempt",
          category: "Office Setup",
          debit: 200,
          credit: 0,
          paymentMode: "Cash",
          bankOrCash: "Cash",
        })
      );
      formData.append("billFile", fakePng);

      const req = new Request("http://localhost:3000/api/transactions", {
        method: "POST",
        body: formData,
      });

      const res = await transactionsPOST(req);
      assert.strictEqual(res.status, 409, "Should fail with 409 conflict");

      // Verify that no orphaned file remains in GridFS
      const billsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, {
        bucketName: "transaction_bills",
      });
      const files = await billsBucket.find({ "metadata.originalName": "receipt.png" }).toArray();
      assert.strictEqual(files.length, 0, "Uploaded file must be cleaned up on transaction failure");
      console.log("   ✅ Uploaded file cleanly rolled back and deleted upon database failure.");
    }

    // --------------------------------------------------------------------------
    // Test 12: Verify balances, liquidity, and origins remain unchanged
    // --------------------------------------------------------------------------
    console.log("▶ Test 12: Financial calculations (Balances, Liquidity, Pre-Company) integrity");
    {
      await Transaction.deleteMany({});

      // Transaction A: Credit ₹100,000 to Company Bank
      await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: new Date("2026-05-01T10:00:00Z"),
        description: "Initial Capital",
        category: "Capital",
        debit: 0,
        credit: 100000,
        paymentMode: "Bank Transfer",
        bankOrCash: "Bank",
      });

      // Transaction B: Debit ₹20,000 with bill attachment
      const pdf = createMockPdfBuffer();
      const storedPdf = await uploadBillToGridFS({
        buffer: pdf,
        filename: "rent.pdf",
        contentType: "application/pdf",
      });
      await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: new Date("2026-05-02T10:00:00Z"),
        description: "Office Rent",
        category: "Office Setup",
        debit: 20000,
        credit: 0,
        paymentMode: "Bank Transfer",
        bankOrCash: "Bank",
        attachment: {
          fileId: storedPdf.fileId,
          url: storedPdf.url,
          originalName: storedPdf.originalName,
          mimeType: storedPdf.mimeType,
          size: storedPdf.size,
        },
      });

      // Transaction C: Pre-company debit paid by Personal Bank (does NOT debit company bank)
      await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "PRE_COMPANY",
        paidBy: "Alan Nixon",
        date: new Date("2026-05-03T10:00:00Z"),
        description: "Pre-company stamp duty",
        category: "Registration Expense",
        debit: 5000,
        credit: 0,
        paymentMode: "UPI",
        bankOrCash: "Personal Bank",
      });

      const txResult = await getTransactions({ accountType: "MAIN", transactionOrigin: "COMPANY" });
      const liquid = await getLiquidBalances();

      // Company Bank: 100,000 - 20,000 = 80,000
      assert.strictEqual(liquid.bankBalance, 80000, "Liquid bank balance should be ₹80,000");
      assert.strictEqual(liquid.totalLiquidCapital, 80000, "Total liquid capital should be ₹80,000");

      // Balance of latest company transaction: 100,000 - 20,000 = 80,000
      const rentTx = txResult.transactions.find((t) => t.description === "Office Rent");
      assert.ok(rentTx);
      assert.strictEqual(rentTx.calculatedBalance, 80000);
      assert.strictEqual(rentTx.billAvailable, true);

      console.log("   ✅ Financial rules, ledger balances, and liquidity unaffected by bill attachments.");
    }

    // --------------------------------------------------------------------------
    // Test 13: Edit transaction: replace attachment and remove attachment
    // --------------------------------------------------------------------------
    console.log("▶ Test 13: Edit transaction: replacement and removal cleanup");
    {
      const pdf = createMockPdfBuffer();
      const storedPdf = await uploadBillToGridFS({
        buffer: pdf,
        filename: "initial_bill.pdf",
        contentType: "application/pdf",
      });

      const tx = await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: new Date("2026-05-10T10:00:00Z"),
        description: "Software License",
        category: "Software",
        debit: 5000,
        credit: 0,
        paymentMode: "Card",
        bankOrCash: "Bank",
        attachment: {
          fileId: storedPdf.fileId,
          url: storedPdf.url,
          originalName: storedPdf.originalName,
          mimeType: storedPdf.mimeType,
          size: storedPdf.size,
        },
      });

      // Replacement: Replace initial_bill.pdf with new_bill.png
      const pngBuf = createMockPngBuffer();
      const storedPng = await uploadBillToGridFS({
        buffer: pngBuf,
        filename: "new_bill.png",
        contentType: "image/png",
      });

      const updated = await updateTransaction(String(tx._id), {
        attachment: {
          fileId: storedPng.fileId,
          url: storedPng.url,
          originalName: storedPng.originalName,
          mimeType: storedPng.mimeType,
          size: storedPng.size,
        },
      });

      assert.strictEqual(updated?.attachment?.originalName, "new_bill.png");

      // Verify old file was cleaned up from GridFS
      const oldCheck = await getBillFromGridFS(storedPdf.fileId);
      assert.strictEqual(oldCheck, null, "Old bill file should be deleted after replacement");

      // Removal: Remove attachment completely
      const removed = await updateTransaction(String(tx._id), {
        attachment: null,
      });

      assert.strictEqual(removed?.billAvailable, false);
      assert.strictEqual(removed?.attachment, undefined);

      const pngCheck = await getBillFromGridFS(storedPng.fileId);
      assert.strictEqual(pngCheck, null, "Replaced bill file should be deleted after removal");

      console.log("   ✅ File replacement and removal cleaned up unreferenced GridFS files safely.");
    }

    console.log("\n🎉 All 13 Bill Attachment Test Scenarios Passed Successfully!");
  } finally {
    await teardown();
  }
}

runAllTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});

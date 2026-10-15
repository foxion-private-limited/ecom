/**
 * Comprehensive Automated Test Suite for Foxion Tax Invoice System
 *
 * Covers:
 * 1. Decimal-safe GST calculations (intra-state CGST+SGST, inter-state IGST, %, fixed discounts, round-off)
 * 2. Number to Indian currency words conversion (lakhs, crores, paise)
 * 3. Indian Financial Year boundary calculations & validations
 * 4. Production registration readiness & effective date safeguards
 * 5. Concurrency-safe invoice numbering counter
 * 6. HTML template generation & watermark verification
 * 7. Playwright Chromium PDF generation
 * 8. Playwright Chromium PNG export
 * 9. GridFS PDF upload, checksum validation, and retrieval
 */

import assert from "assert";
import mongoose from "mongoose";
import {
  calculateLineItem,
  calculateInvoiceTotals,
  InvoiceLineItemInput,
} from "../lib/invoices/calculations";
import { amountToWords } from "../lib/invoices/numberToWords";
import {
  getFinancialYear,
  isInvoiceDateValid,
} from "../lib/invoices/financialYear";
import {
  checkProductionReadiness,
} from "../lib/services/invoiceSettingsService";
import { renderInvoiceHtml } from "../lib/invoices/template";
import { buildInvoiceViewModel } from "../lib/invoices/viewModel";
import { renderHtmlToPdf } from "../lib/invoices/pdfRenderer";
import { renderHtmlToPngs } from "../lib/invoices/pngRenderer";
import {
  saveInvoicePdf,
  getInvoicePdfBuffer,
  deleteInvoiceFile,
  computeSha256,
} from "../lib/services/invoiceStorageService";
import { connectDB } from "../lib/db/connection";
import { allocateInvoiceNumber } from "../lib/services/invoiceNumberService";
import { InvoiceCounter } from "../lib/models/InvoiceCounter";
import { IInvoiceSettings } from "../lib/models/InvoiceSettings";

let passedCount = 0;
let totalCount = 0;

function it(name: string, fn: () => void | Promise<void>) {
  totalCount++;
  return (async () => {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passedCount++;
    } catch (err: unknown) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(err);
      throw err;
    }
  })();
}

async function runAllTests() {
  console.log("\n========================================================");
  console.log("   FOXION TAX INVOICE SYSTEM — AUTOMATED TEST SUITE     ");
  console.log("========================================================\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Calculations & Tax Breakdowns
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("▶ [Suite 1] Decimal-Safe Calculations & GST Split");

  await it("Calculates intra-state supply with 18% GST (CGST 9% + SGST 9%)", () => {
    const item: InvoiceLineItemInput = {
      description: "Apparel T-Shirt",
      hsnSac: "61091000",
      quantity: 2,
      unit: "PCS",
      unitPrice: 500, // Total 1000
      discountType: "NONE",
      discountValue: 0,
      gstRate: 18,
    };

    const res = calculateLineItem(item, "INTRA_STATE");
    assert.strictEqual(res.taxableValue, 1000, "Taxable value must be 1000");
    assert.strictEqual(res.cgstRate, 9, "CGST rate must be 9%");
    assert.strictEqual(res.sgstRate, 9, "SGST rate must be 9%");
    assert.strictEqual(res.cgstAmount, 90, "CGST amount must be 90");
    assert.strictEqual(res.sgstAmount, 90, "SGST amount must be 90");
    assert.strictEqual(res.igstAmount, 0, "IGST amount must be 0 for intra-state");
    assert.strictEqual(res.gstAmount, 180, "Total GST must be 180");
    assert.strictEqual(res.lineTotal, 1180, "Line total must be 1180");
  });

  await it("Calculates inter-state supply with 18% GST (IGST 18%)", () => {
    const item: InvoiceLineItemInput = {
      description: "Apparel T-Shirt",
      hsnSac: "61091000",
      quantity: 1,
      unit: "PCS",
      unitPrice: 1000,
      discountType: "NONE",
      discountValue: 0,
      gstRate: 18,
    };

    const res = calculateLineItem(item, "INTER_STATE");
    assert.strictEqual(res.taxableValue, 1000);
    assert.strictEqual(res.cgstAmount, 0);
    assert.strictEqual(res.sgstAmount, 0);
    assert.strictEqual(res.igstRate, 18);
    assert.strictEqual(res.igstAmount, 180);
    assert.strictEqual(res.gstAmount, 180);
    assert.strictEqual(res.lineTotal, 1180);
  });

  await it("Handles percentage discount correctly", () => {
    const item: InvoiceLineItemInput = {
      description: "Sneakers",
      hsnSac: "64041100",
      quantity: 1,
      unit: "PAIR",
      unitPrice: 2000,
      discountType: "PERCENT",
      discountValue: 10, // 10% of 2000 = 200 discount -> taxable 1800
      gstRate: 12,
    };

    const res = calculateLineItem(item, "INTRA_STATE");
    assert.strictEqual(res.discountAmount, 200);
    assert.strictEqual(res.taxableValue, 1800);
    assert.strictEqual(res.cgstAmount, 108); // 6% of 1800
    assert.strictEqual(res.sgstAmount, 108); // 6% of 1800
    assert.strictEqual(res.lineTotal, 2016);
  });

  await it("Handles fixed discount correctly", () => {
    const item: InvoiceLineItemInput = {
      description: "Backpack",
      hsnSac: "42021200",
      quantity: 1,
      unit: "PCS",
      unitPrice: 1500,
      discountType: "FIXED",
      discountValue: 300, // 300 discount -> taxable 1200
      gstRate: 18,
    };

    const res = calculateLineItem(item, "INTER_STATE");
    assert.strictEqual(res.discountAmount, 300);
    assert.strictEqual(res.taxableValue, 1200);
    assert.strictEqual(res.igstAmount, 216); // 18% of 1200
    assert.strictEqual(res.lineTotal, 1416);
  });

  await it("Reconciles multiple line items with different GST rates and round-off", () => {
    const items: InvoiceLineItemInput[] = [
      {
        description: "Cotton Fabric",
        hsnSac: "52081100",
        quantity: 3,
        unit: "MTR",
        unitPrice: 250.75, // gross 752.25
        discountType: "NONE",
        discountValue: 0,
        gstRate: 5,
      },
      {
        description: "Designer Jacket",
        hsnSac: "62011100",
        quantity: 1,
        unit: "PCS",
        unitPrice: 3499.5,
        discountType: "PERCENT",
        discountValue: 15, // discount 524.93 -> taxable 2974.57
        gstRate: 12,
      },
    ];

    const totals = calculateInvoiceTotals(items, "INTRA_STATE", true);
    assert(totals.taxableSubtotal > 0);
    assert(totals.totalGst > 0);
    // Ensure amountPayable matches Math.round(grossTotal)
    assert.strictEqual(
      totals.amountPayable,
      Math.round(totals.grossTotal),
      "Amount payable must match rounded gross total"
    );
    assert.strictEqual(
      totals.amountPayable,
      totals.grossTotal + totals.roundOff,
      "Reconciliation check: grossTotal + roundOff === amountPayable"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Number to Indian Words
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [Suite 2] Amount to Indian Words (Lakhs & Crores)");

  await it("Converts exact rupees to words", () => {
    const words = amountToWords(1180);
    assert.strictEqual(words, "Rupees One Thousand One Hundred Eighty Only");
  });

  await it("Converts rupees with paise", () => {
    const words = amountToWords(1500.5);
    assert.strictEqual(
      words,
      "Rupees One Thousand Five Hundred and Fifty Paise Only"
    );
  });

  await it("Converts Lakh values in Indian numbering system", () => {
    const words = amountToWords(253450);
    assert.strictEqual(
      words,
      "Rupees Two Lakh Fifty Three Thousand Four Hundred Fifty Only"
    );
  });

  await it("Converts Crore values in Indian numbering system", () => {
    const words = amountToWords(12500000);
    assert.strictEqual(
      words,
      "Rupees One Crore Twenty Five Lakh Only"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Indian Financial Year Boundaries
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [Suite 3] Indian Financial Year Boundaries");

  await it("Correctly identifies FY for date in April", () => {
    const fy = getFinancialYear(new Date("2026-04-15T10:00:00Z"));
    assert.strictEqual(fy.label, "2026-27");
    assert.strictEqual(fy.code, "26-27");
  });

  await it("Correctly identifies FY for date in March (prior calendar year start)", () => {
    const fy = getFinancialYear(new Date("2027-03-31T12:00:00Z"));
    assert.strictEqual(fy.label, "2026-27");
    assert.strictEqual(fy.code, "26-27");
  });

  await it("Correctly transitions to next FY on April 1", () => {
    const fy = getFinancialYear(new Date("2027-04-01T04:00:00Z"));
    assert.strictEqual(fy.label, "2027-28");
    assert.strictEqual(fy.code, "27-28");
  });

  await it("Validates invoice date against registration effective date", () => {
    const effective = new Date("2026-06-01");
    assert.strictEqual(
      isInvoiceDateValid(new Date("2026-06-15"), effective),
      true,
      "Invoice date after effective date must be valid"
    );
    assert.strictEqual(
      isInvoiceDateValid(new Date("2026-06-01"), effective),
      true,
      "Invoice date on effective date must be valid"
    );
    assert.strictEqual(
      isInvoiceDateValid(new Date("2026-05-31"), effective),
      false,
      "Invoice date before effective date must be rejected"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Registration Safeguards
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [Suite 4] Registration Safeguards & Readiness");

  await it("Blocks production readiness when registration is unverified", () => {
    const fakeSettings = {
      sellerLegalName: "Foxion Private Limited",
      sellerAddress: {
        line1: "Ring Road",
        city: "Surat",
        state: "Gujarat",
        stateCode: "24",
      },
      sellerGstin: "24ABCDE1234F1Z5",
      gstRegistrationEffectiveDate: new Date("2026-04-01"),
      registrationVerified: false,
    } as unknown as IInvoiceSettings;

    const readiness = checkProductionReadiness(fakeSettings);
    assert.strictEqual(readiness.isReady, false);
    assert(readiness.blockers.some((b) => b.includes("not been verified")));
  });

  await it("Blocks production readiness when GSTIN is missing", () => {
    const fakeSettings = {
      sellerLegalName: "Foxion Private Limited",
      sellerAddress: {
        line1: "Ring Road",
        city: "Surat",
        state: "Gujarat",
        stateCode: "24",
      },
      sellerGstin: "",
      gstRegistrationEffectiveDate: new Date("2026-04-01"),
      registrationVerified: true,
    } as unknown as IInvoiceSettings;

    const readiness = checkProductionReadiness(fakeSettings);
    assert.strictEqual(readiness.isReady, false);
    assert(readiness.blockers.some((b) => b.includes("GSTIN is missing")));
  });

  await it("Allows production readiness only when all safeguards pass", () => {
    const fakeSettings = {
      sellerLegalName: "Foxion Private Limited",
      sellerAddress: {
        line1: "Ring Road",
        city: "Surat",
        state: "Gujarat",
        stateCode: "24",
      },
      sellerGstin: "24ABCDE1234F1Z5",
      gstRegistrationEffectiveDate: new Date("2026-04-01"),
      registrationVerified: true,
    } as unknown as IInvoiceSettings;

    const readiness = checkProductionReadiness(fakeSettings);
    assert.strictEqual(readiness.isReady, true);
    assert.strictEqual(readiness.blockers.length, 0);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Database Connection & Concurrency-Safe Number Allocation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [Suite 5] Database, Atomic Counter & Concurrency Isolation");

  await connectDB();

  await it("Allocates sequential invoice numbers and isolates TEST from PRODUCTION", async () => {
    // Clean test counters for predictability
    await InvoiceCounter.deleteMany({ financialYear: "99-00" });

    const num1 = await allocateInvoiceNumber("TEST", "99-00", "INV");
    const num2 = await allocateInvoiceNumber("TEST", "99-00", "INV");
    assert.strictEqual(num1, "INV/99-00/001");
    assert.strictEqual(num2, "INV/99-00/002");

    // PRODUCTION counter with same FY must start at 001 independently
    const prod1 = await allocateInvoiceNumber("PRODUCTION", "99-00", "INV");
    assert.strictEqual(prod1, "INV/99-00/001");

    // Clean up test counters
    await InvoiceCounter.deleteMany({ financialYear: "99-00" });
  });

  await it("Handles concurrent invoice number allocations safely", async () => {
    await InvoiceCounter.deleteMany({ financialYear: "98-99" });

    // Launch 10 simultaneous allocations
    const promises = Array.from({ length: 10 }, () =>
      allocateInvoiceNumber("TEST", "98-99", "INV")
    );
    const allocated = await Promise.all(promises);

    // Ensure all 10 are unique
    const uniqueSet = new Set(allocated);
    assert.strictEqual(uniqueSet.size, 10, "Every concurrent number must be unique");

    await InvoiceCounter.deleteMany({ financialYear: "98-99" });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. HTML Template & Watermark Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [Suite 6] HTML Template & Test Watermark Verification");

  await it("Includes mandatory watermark and disclaimer in TEST mode", () => {
    const totals = calculateInvoiceTotals(
      [
        {
          description: "Cotton Shirt",
          hsnSac: "61091000",
          quantity: 1,
          unit: "PCS",
          unitPrice: 1000,
          discountType: "NONE",
          discountValue: 0,
          gstRate: 18,
        },
      ],
      "INTRA_STATE"
    );

    const testInvoice = {
      mode: "TEST" as const,
      status: "DRAFT" as const,
      serialNumber: "INV/26-27/001",
      financialYear: "2026-27",
      invoiceDate: new Date("2026-05-10"),
      taxTreatment: "INTRA_STATE" as const,
      buyer: {
        name: "Test Customer",
        type: "B2C_UNREGISTERED" as const,
        billingAddress: {
          line1: "Test Street",
          city: "Ahmedabad",
          state: "Gujarat",
          stateCode: "24",
          country: "India",
        },
        placeOfSupply: "Gujarat",
        placeOfSupplyCode: "24",
      },
      lineItems: totals.lineItems,
    };

    const fakeSettings = {
      sellerLegalName: "Foxion Private Limited",
      sellerAddress: {
        line1: "Trade Center",
        city: "Surat",
        state: "Gujarat",
        stateCode: "24",
      },
      sellerGstin: "24ABCDE1234F1Z5",
      brandColor: "#1e3a5f",
    } as unknown as IInvoiceSettings;

    const vm = buildInvoiceViewModel(testInvoice, fakeSettings, totals);
    const html = renderInvoiceHtml(vm);

    // Mandatory exact wording check
    assert(
      html.includes("TEST INVOICE — NOT VALID FOR GST CLAIM OR FILING"),
      "HTML must contain exact required test disclaimer"
    );
    assert(html.includes("watermark-text"), "HTML must contain watermark class");
    assert(html.includes("TEST INVOICE"), "HTML must contain watermark text");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Playwright PDF & PNG Generation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [Suite 7] Playwright PDF & PNG Rendering Engine");

  const sampleHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 20px; }
    .page { width: 210mm; min-height: 297mm; background: white; padding: 15mm; }
    h1 { color: #1e3a5f; }
  </style>
</head>
<body>
  <div class="page">
    <h1>Foxion Automated Test Invoice</h1>
    <p>Testing Playwright Chromium serverless-ready PDF & PNG rendering.</p>
  </div>
</body>
</html>`;

  let generatedPdfBuffer: Buffer | null = null;

  await it("Renders valid PDF buffer via Playwright Chromium", async () => {
    const pdfBuffer = await renderHtmlToPdf(sampleHtml);
    assert(pdfBuffer instanceof Buffer, "Result must be a Buffer");
    assert(pdfBuffer.length > 1000, "PDF buffer must contain content (>1KB)");

    // PDF files start with '%PDF-'
    const header = pdfBuffer.slice(0, 5).toString();
    assert.strictEqual(header, "%PDF-", "Generated buffer must have valid PDF magic header");

    generatedPdfBuffer = pdfBuffer;
  });

  await it("Renders valid PNG image via Playwright Chromium", async () => {
    const pngResults = await renderHtmlToPngs(sampleHtml, "test_inv");
    assert(Array.isArray(pngResults), "Must return array of PNG pages");
    assert(pngResults.length >= 1, "Must generate at least one page");

    const firstPage = pngResults[0];
    assert(firstPage.buffer.length > 1000, "PNG buffer must contain image bytes");

    // PNG files start with 0x89 'P' 'N' 'G'
    assert.strictEqual(firstPage.buffer[0], 0x89);
    assert.strictEqual(firstPage.buffer.slice(1, 4).toString(), "PNG");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. GridFS Permanent Storage & Checksum
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n▶ [Suite 8] GridFS Permanent Archival & Checksums");

  if (generatedPdfBuffer) {
    let storedId: mongoose.Types.ObjectId | null = null;
    const originalChecksum = computeSha256(generatedPdfBuffer);

    await it("Stores PDF permanently in GridFS 'taxinvoicepdfs' bucket with SHA-256", async () => {
      const result = await saveInvoicePdf(generatedPdfBuffer!, {
        invoiceId: new mongoose.Types.ObjectId().toString(),
        serialNumber: "TEST_INV_001",
        mode: "TEST",
        financialYear: "2026-27",
        originalFilename: "TEST_INV_001.pdf",
        templateVersion: "1.0",
      });

      assert(result.fileId, "Must return GridFS fileId");
      assert.strictEqual(result.checksum, originalChecksum, "Checksum must match SHA-256");
      storedId = result.fileId;
    });

    await it("Retrieves exact canonical PDF buffer from GridFS and verifies integrity", async () => {
      assert(storedId, "Stored ID must exist");
      const fetched = await getInvoicePdfBuffer(storedId);

      assert.strictEqual(
        fetched.buffer.length,
        generatedPdfBuffer!.length,
        "Buffer lengths must match"
      );
      const retrievedChecksum = computeSha256(fetched.buffer);
      assert.strictEqual(
        retrievedChecksum,
        originalChecksum,
        "Retrieved file SHA-256 must match original"
      );
      assert.strictEqual(fetched.metadata?.serialNumber, "TEST_INV_001");

      // Cleanup test file from GridFS
      await deleteInvoiceFile(storedId, "pdf");
    });
  }

  console.log("\n========================================================");
  console.log(`   ALL TESTS PASSED: ${passedCount} / ${totalCount} SUCCESSFUL! `);
  console.log("========================================================\n");

  process.exit(0);
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

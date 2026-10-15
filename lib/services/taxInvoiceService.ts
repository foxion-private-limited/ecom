import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connection";
import { TaxInvoice, ITaxInvoice } from "@/lib/models/TaxInvoice";
import {
  CreateInvoiceDraftInput,
  createInvoiceDraftSchema,
  UpdateInvoiceDraftInput,
  updateInvoiceDraftSchema,
  ListInvoicesInput,
} from "@/lib/invoices/validation";
import {
  calculateInvoiceTotals,
  InvoiceTotals,
} from "@/lib/invoices/calculations";
import {
  getFinancialYearLabel,
  getFinancialYearCode,
  isInvoiceDateValid,
} from "@/lib/invoices/financialYear";
import { amountToWords } from "@/lib/invoices/numberToWords";
import { buildInvoiceViewModel, InvoiceViewModel } from "@/lib/invoices/viewModel";
import { renderInvoiceHtml } from "@/lib/invoices/template";
import { renderHtmlToPdf } from "@/lib/invoices/pdfRenderer";
import { renderHtmlToPngs } from "@/lib/invoices/pngRenderer";
import {
  getInvoiceSettings,
  checkProductionReadiness,
} from "@/lib/services/invoiceSettingsService";
import { allocateInvoiceNumber } from "@/lib/services/invoiceNumberService";
import {
  saveInvoicePdf,
  saveInvoicePng,
  deleteInvoiceFile,
} from "@/lib/services/invoiceStorageService";

/**
 * Creates a new invoice in DRAFT status.
 * Authoritative calculations are performed on the server.
 * No permanent invoice number is consumed for drafts.
 */
export async function createInvoiceDraft(
  input: CreateInvoiceDraftInput,
  user: string
): Promise<ITaxInvoice> {
  await connectDB();

  const validated = createInvoiceDraftSchema.parse(input);
  const settings = await getInvoiceSettings();

  // If settings dictate testMode, ensure mode reflects it or respect request
  const mode = validated.mode || (settings.testMode ? "TEST" : "PRODUCTION");

  // Recalculate totals authoritatively
  const totals = calculateInvoiceTotals(
    validated.items,
    validated.taxTreatment,
    validated.applyRoundOff
  );

  const amountInWordsText = amountToWords(totals.amountPayable);
  const financialYear = getFinancialYearLabel(validated.invoiceDate);

  const invoice = new TaxInvoice({
    mode,
    status: "DRAFT",
    financialYear,
    invoiceDate: validated.invoiceDate,
    buyer: {
      name: validated.buyerName,
      type: validated.buyerType,
      gstin: validated.buyerGstin,
      billingAddress: validated.buyerBillingAddress,
      shippingAddress: validated.buyerShippingAddress,
      phone: validated.buyerPhone,
      email: validated.buyerEmail,
      placeOfSupply: validated.placeOfSupply,
      placeOfSupplyCode: validated.placeOfSupplyCode,
    },
    platform: validated.platform,
    marketplaceOrderId: validated.marketplaceOrderId,
    marketplaceRef: validated.marketplaceRef,
    courierCompany: validated.courierCompany,
    awbNumber: validated.awbNumber,
    trackingNumber: validated.trackingNumber,
    taxTreatment: validated.taxTreatment,
    applyRoundOff: validated.applyRoundOff,
    reverseChargeApplicable: validated.reverseChargeApplicable,
    lineItems: totals.lineItems,
    taxSummary: {
      taxableSubtotal: totals.taxableSubtotal,
      totalDiscount: totals.totalDiscount,
      cgstTotal: totals.cgstTotal,
      sgstTotal: totals.sgstTotal,
      igstTotal: totals.igstTotal,
      totalGst: totals.totalGst,
      grossTotal: totals.grossTotal,
      roundOff: totals.roundOff,
      amountPayable: totals.amountPayable,
      amountInWords: amountInWordsText,
    },
    notes: validated.notes,
    paymentTerms: validated.paymentTerms,
    additionalDeclarations: validated.additionalDeclarations,
    createdBy: user,
    templateVersion: "1.0",
  });

  await invoice.save();
  return invoice;
}

/**
 * Updates an existing DRAFT invoice.
 * Once an invoice is ISSUED or CANCELLED, edits are strictly prohibited.
 */
export async function updateInvoiceDraft(
  id: string,
  input: UpdateInvoiceDraftInput,
  _user: string
): Promise<ITaxInvoice> {
  await connectDB();

  const validated = updateInvoiceDraftSchema.parse(input);
  const invoice = await TaxInvoice.findById(id);

  if (!invoice) {
    throw new Error(`Invoice with ID ${id} not found`);
  }

  if (invoice.status !== "DRAFT") {
    throw new Error(`Cannot modify invoice with status ${invoice.status}. Issued records are immutable.`);
  }

  // Recalculate totals if items or tax treatment are supplied
  const items = validated.items || invoice.lineItems.map((li) => ({
    description: li.description,
    hsnSac: li.hsnSac,
    quantity: li.quantity,
    unit: li.unit,
    unitPrice: li.unitPrice,
    discountType: li.discountType,
    discountValue: li.discountValue,
    gstRate: li.gstRate,
  }));

  const taxTreatment = validated.taxTreatment || invoice.taxTreatment;
  const applyRoundOff =
    validated.applyRoundOff !== undefined ? validated.applyRoundOff : invoice.applyRoundOff;

  const totals = calculateInvoiceTotals(items, taxTreatment, applyRoundOff);
  const amountInWordsText = amountToWords(totals.amountPayable);

  if (validated.invoiceDate) {
    invoice.invoiceDate = validated.invoiceDate;
    invoice.financialYear = getFinancialYearLabel(validated.invoiceDate);
  }

  if (validated.mode) {
    invoice.mode = validated.mode;
  }

  // Update Buyer
  if (validated.buyerName) invoice.buyer.name = validated.buyerName;
  if (validated.buyerType) invoice.buyer.type = validated.buyerType;
  if (validated.buyerGstin !== undefined) invoice.buyer.gstin = validated.buyerGstin;
  if (validated.buyerBillingAddress) invoice.buyer.billingAddress = validated.buyerBillingAddress;
  if (validated.buyerShippingAddress !== undefined)
    invoice.buyer.shippingAddress = validated.buyerShippingAddress;
  if (validated.buyerPhone !== undefined) invoice.buyer.phone = validated.buyerPhone;
  if (validated.buyerEmail !== undefined) invoice.buyer.email = validated.buyerEmail;
  if (validated.placeOfSupply) invoice.buyer.placeOfSupply = validated.placeOfSupply;
  if (validated.placeOfSupplyCode) invoice.buyer.placeOfSupplyCode = validated.placeOfSupplyCode;

  // Marketplace & Logistics
  if (validated.platform !== undefined) invoice.platform = validated.platform;
  if (validated.marketplaceOrderId !== undefined)
    invoice.marketplaceOrderId = validated.marketplaceOrderId;
  if (validated.marketplaceRef !== undefined) invoice.marketplaceRef = validated.marketplaceRef;
  if (validated.courierCompany !== undefined) invoice.courierCompany = validated.courierCompany;
  if (validated.awbNumber !== undefined) invoice.awbNumber = validated.awbNumber;
  if (validated.trackingNumber !== undefined) invoice.trackingNumber = validated.trackingNumber;

  invoice.taxTreatment = taxTreatment;
  invoice.applyRoundOff = applyRoundOff;
  if (validated.reverseChargeApplicable !== undefined) {
    invoice.reverseChargeApplicable = validated.reverseChargeApplicable;
  }

  invoice.lineItems = totals.lineItems;
  invoice.taxSummary = {
    taxableSubtotal: totals.taxableSubtotal,
    totalDiscount: totals.totalDiscount,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    totalGst: totals.totalGst,
    grossTotal: totals.grossTotal,
    roundOff: totals.roundOff,
    amountPayable: totals.amountPayable,
    amountInWords: amountInWordsText,
  };

  if (validated.notes !== undefined) invoice.notes = validated.notes;
  if (validated.paymentTerms !== undefined) invoice.paymentTerms = validated.paymentTerms;
  if (validated.additionalDeclarations !== undefined) {
    invoice.additionalDeclarations = validated.additionalDeclarations;
  }

  await invoice.save();
  return invoice;
}

/**
 * Issue an invoice.
 * Complete production issuance workflow with strict safeguards:
 * 1. Checks registration verification and effective date if PRODUCTION mode
 * 2. Recalculates authoritative totals
 * 3. Concurrency-safe serial number allocation via InvoiceCounter
 * 4. Freezes immutable seller snapshot
 * 5. Generates canonical PDF from HTML template
 * 6. Archives PDF in GridFS
 * 7. Optionally generates PNGs and archives in GridFS
 * 8. Locks record to ISSUED status
 */
export async function issueInvoice(
  id: string,
  user: string,
  options?: { idempotencyKey?: string; exportPng?: boolean }
): Promise<ITaxInvoice> {
  await connectDB();

  const invoice = await TaxInvoice.findById(id);
  if (!invoice) {
    throw new Error(`Invoice with ID ${id} not found`);
  }

  // Idempotency check: if already issued with matching idempotencyKey, return it
  if (
    invoice.status === "ISSUED" &&
    options?.idempotencyKey &&
    invoice.idempotencyKey === options.idempotencyKey
  ) {
    return invoice;
  }

  if (invoice.status !== "DRAFT") {
    throw new Error(`Cannot issue invoice with status '${invoice.status}'`);
  }

  const settings = await getInvoiceSettings();

  // PRODUCTION MODE SAFEGUARDS
  if (invoice.mode === "PRODUCTION") {
    const readiness = checkProductionReadiness(settings);
    if (!readiness.isReady) {
      throw new Error(
        `Production invoice issuance blocked: ${readiness.blockers.join("; ")}`
      );
    }

    if (
      settings.gstRegistrationEffectiveDate &&
      !isInvoiceDateValid(invoice.invoiceDate, settings.gstRegistrationEffectiveDate)
    ) {
      throw new Error(
        `Cannot issue production GST invoice dated prior to GST registration effective date (${settings.gstRegistrationEffectiveDate.toISOString().slice(0, 10)})`
      );
    }
  }

  // Authoritative server-side recalculation
  const lineItemInputs = invoice.lineItems.map((li) => ({
    description: li.description,
    hsnSac: li.hsnSac,
    quantity: li.quantity,
    unit: li.unit,
    unitPrice: li.unitPrice,
    discountType: li.discountType,
    discountValue: li.discountValue,
    gstRate: li.gstRate,
  }));

  const totals = calculateInvoiceTotals(
    lineItemInputs,
    invoice.taxTreatment,
    invoice.applyRoundOff
  );

  const amountInWordsText = amountToWords(totals.amountPayable);
  const fyCode = getFinancialYearCode(invoice.invoiceDate);
  const fyLabel = getFinancialYearLabel(invoice.invoiceDate);

  // Allocate unique sequential serial number
  const serialNumber = await allocateInvoiceNumber(
    invoice.mode,
    fyCode,
    settings.invoicePrefix || "INV"
  );

  // Create immutable Seller Snapshot
  const sellerSnapshot = {
    legalName: settings.sellerLegalName,
    tradeName: settings.sellerTradeName,
    address: settings.sellerAddress,
    gstin: settings.sellerGstin,
    phone: settings.sellerPhone,
    email: settings.sellerEmail,
    logoUrl: settings.logoUrl,
    brandColor: settings.brandColor || "#1e3a5f",
  };

  invoice.serialNumber = serialNumber;
  invoice.financialYear = fyLabel;
  invoice.sellerSnapshot = sellerSnapshot;
  invoice.lineItems = totals.lineItems;
  invoice.taxSummary = {
    taxableSubtotal: totals.taxableSubtotal,
    totalDiscount: totals.totalDiscount,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    totalGst: totals.totalGst,
    grossTotal: totals.grossTotal,
    roundOff: totals.roundOff,
    amountPayable: totals.amountPayable,
    amountInWords: amountInWordsText,
  };

  // Build ViewModel and render HTML
  const viewModel = buildInvoiceViewModel(invoice, settings, totals);
  const html = renderInvoiceHtml(viewModel);

  // Generate canonical PDF
  let pdfFileId: mongoose.Types.ObjectId | null = null;
  const pngFileIds: mongoose.Types.ObjectId[] = [];
  const pngFilenames: string[] = [];

  try {
    const pdfBuffer = await renderHtmlToPdf(html);
    const safeSerialForFilename = serialNumber.replace(/[\/\\]/g, "_");
    const pdfFilename = `${safeSerialForFilename}.pdf`;

    const savedPdf = await saveInvoicePdf(pdfBuffer, {
      invoiceId: invoice._id.toString(),
      serialNumber,
      mode: invoice.mode,
      financialYear: fyLabel,
      originalFilename: pdfFilename,
      templateVersion: invoice.templateVersion || "1.0",
    });

    pdfFileId = savedPdf.fileId;
    invoice.pdfGridFsId = savedPdf.fileId;
    invoice.pdfChecksum = savedPdf.checksum;
    invoice.pdfFilename = pdfFilename;

    // Optional PNG Generation
    if (options?.exportPng) {
      try {
        const pngResults = await renderHtmlToPngs(html, safeSerialForFilename);
        for (const pr of pngResults) {
          const savedPng = await saveInvoicePng(pr.buffer, {
            invoiceId: invoice._id.toString(),
            serialNumber,
            mode: invoice.mode,
            financialYear: fyLabel,
            originalFilename: pr.filename,
            page: pr.pageNumber,
            templateVersion: invoice.templateVersion || "1.0",
          });
          pngFileIds.push(savedPng.fileId);
          pngFilenames.push(pr.filename);
        }
        invoice.pngGridFsIds = pngFileIds;
        invoice.pngFilenames = pngFilenames;
      } catch (pngErr) {
        console.warn("[PNG Generation Warning] PNG export failed, PDF preserved:", pngErr);
      }
    }

    // Commit status change
    invoice.status = "ISSUED";
    invoice.issuedAt = new Date();
    invoice.issuedBy = user;
    if (options?.idempotencyKey) {
      invoice.idempotencyKey = options.idempotencyKey;
    }

    await invoice.save();
    return invoice;
  } catch (err) {
    // Rollback uploaded files on failure to prevent orphaned records in GridFS
    if (pdfFileId) {
      await deleteInvoiceFile(pdfFileId, "pdf");
    }
    for (const id of pngFileIds) {
      await deleteInvoiceFile(id, "png");
    }
    throw err;
  }
}

/**
 * Cancel an issued invoice.
 * Preserves the canonical PDF, serial number, and audit history.
 */
export async function cancelInvoice(
  id: string,
  reason: string,
  user: string
): Promise<ITaxInvoice> {
  await connectDB();

  const invoice = await TaxInvoice.findById(id);
  if (!invoice) {
    throw new Error(`Invoice with ID ${id} not found`);
  }

  if (invoice.status !== "ISSUED") {
    throw new Error(`Only issued invoices can be cancelled. Current status: ${invoice.status}`);
  }

  invoice.status = "CANCELLED";
  invoice.cancellation = {
    cancelledAt: new Date(),
    cancelledBy: user,
    reason,
  };

  await invoice.save();
  return invoice;
}

/**
 * Delete a draft invoice.
 * Only DRAFT status invoices can be deleted.
 */
export async function deleteInvoiceDraft(id: string): Promise<boolean> {
  await connectDB();

  const invoice = await TaxInvoice.findById(id);
  if (!invoice) {
    throw new Error(`Invoice with ID ${id} not found`);
  }

  if (invoice.status !== "DRAFT") {
    throw new Error(`Only draft invoices can be deleted. Current status: ${invoice.status}`);
  }

  await TaxInvoice.findByIdAndDelete(id);
  return true;
}

/**
 * Get single invoice by ID.
 */
export async function getInvoiceById(id: string): Promise<ITaxInvoice | null> {
  await connectDB();
  return TaxInvoice.findById(id);
}

/**
 * List invoices with filters, search, and pagination.
 */
export async function listInvoices(params: ListInvoicesInput): Promise<{
  invoices: ITaxInvoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  await connectDB();

  const query: Record<string, unknown> = {};

  if (params.mode && params.mode !== "ALL") {
    query.mode = params.mode;
  }

  if (params.status && params.status !== "ALL") {
    query.status = params.status;
  }

  if (params.financialYear) {
    query.financialYear = params.financialYear;
  }

  if (params.startDate || params.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (params.startDate) dateFilter.$gte = new Date(params.startDate);
    if (params.endDate) dateFilter.$lte = new Date(params.endDate);
    query.invoiceDate = dateFilter;
  }

  if (params.search && params.search.trim().length > 0) {
    const s = params.search.trim();
    query.$or = [
      { serialNumber: { $regex: s, $options: "i" } },
      { "buyer.name": { $regex: s, $options: "i" } },
      { marketplaceOrderId: { $regex: s, $options: "i" } },
      { awbNumber: { $regex: s, $options: "i" } },
      { platform: { $regex: s, $options: "i" } },
    ];
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(200, Math.max(1, params.limit || 50));
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    TaxInvoice.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    TaxInvoice.countDocuments(query),
  ]);

  return {
    invoices,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Invoice summary statistics for dashboard.
 */
export async function getInvoiceStats(): Promise<{
  totalInvoices: number;
  productionIssuedCount: number;
  productionIssuedAmount: number;
  testCount: number;
  draftCount: number;
  cancelledCount: number;
}> {
  await connectDB();

  const [
    totalInvoices,
    productionIssued,
    testInvoices,
    draftInvoices,
    cancelledInvoices,
  ] = await Promise.all([
    TaxInvoice.countDocuments(),
    TaxInvoice.find({ mode: "PRODUCTION", status: "ISSUED" }).select("taxSummary"),
    TaxInvoice.countDocuments({ mode: "TEST" }),
    TaxInvoice.countDocuments({ status: "DRAFT" }),
    TaxInvoice.countDocuments({ status: "CANCELLED" }),
  ]);

  const productionIssuedAmount = productionIssued.reduce(
    (sum, inv) => sum + (inv.taxSummary?.amountPayable || 0),
    0
  );

  return {
    totalInvoices,
    productionIssuedCount: productionIssued.length,
    productionIssuedAmount: Math.round(productionIssuedAmount * 100) / 100,
    testCount: testInvoices,
    draftCount: draftInvoices,
    cancelledCount: cancelledInvoices,
  };
}

/**
 * Generate a live, unsaved HTML preview of invoice input.
 * Does NOT save to database and does NOT allocate permanent invoice numbers.
 */
export async function generateLivePreview(input: CreateInvoiceDraftInput): Promise<{
  html: string;
  totals: InvoiceTotals;
  viewModel: InvoiceViewModel;
}> {
  const settings = await getInvoiceSettings();

  const totals = calculateInvoiceTotals(
    input.items,
    input.taxTreatment,
    input.applyRoundOff
  );

  const partialInvoice: Parameters<typeof buildInvoiceViewModel>[0] = {
    mode: input.mode,
    status: "DRAFT",
    serialNumber: `PREVIEW (${input.mode === "TEST" ? "TEST" : "PROD"})`,
    financialYear: getFinancialYearLabel(input.invoiceDate),
    invoiceDate: input.invoiceDate,
    buyer: {
      name: input.buyerName,
      type: input.buyerType,
      gstin: input.buyerGstin,
      billingAddress: input.buyerBillingAddress,
      shippingAddress: input.buyerShippingAddress,
      phone: input.buyerPhone,
      email: input.buyerEmail,
      placeOfSupply: input.placeOfSupply,
      placeOfSupplyCode: input.placeOfSupplyCode,
    },
    platform: input.platform,
    marketplaceOrderId: input.marketplaceOrderId,
    marketplaceRef: input.marketplaceRef,
    courierCompany: input.courierCompany,
    awbNumber: input.awbNumber,
    trackingNumber: input.trackingNumber,
    taxTreatment: input.taxTreatment,
    applyRoundOff: input.applyRoundOff,
    reverseChargeApplicable: input.reverseChargeApplicable,
    lineItems: totals.lineItems,
    notes: input.notes,
    paymentTerms: input.paymentTerms,
    additionalDeclarations: input.additionalDeclarations,
  };

  const viewModel = buildInvoiceViewModel(partialInvoice, settings, totals);
  const html = renderInvoiceHtml(viewModel);

  return {
    html,
    totals,
    viewModel,
  };
}

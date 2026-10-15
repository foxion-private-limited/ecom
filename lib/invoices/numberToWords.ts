/**
 * Converts an INR amount (in rupees) to Indian currency words.
 * Supports values up to 99,99,99,999 (≈ 100 crore).
 * Uses Indian numbering: lakh (1,00,000) and crore (1,00,00,000).
 *
 * Example: 1180.50 → "Rupees One Thousand One Hundred Eighty and Fifty Paise Only"
 */

const ones: readonly string[] = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const tens: readonly string[] = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertHundreds(n: number): string {
  if (n === 0) return "";
  let result = "";
  if (n >= 100) {
    result += ones[Math.floor(n / 100)] + " Hundred";
    n = n % 100;
    if (n > 0) result += " ";
  }
  if (n < 20) {
    result += ones[n];
  } else {
    result += tens[Math.floor(n / 10)];
    if (n % 10 > 0) result += " " + ones[n % 10];
  }
  return result.trim();
}

/**
 * Convert a non-negative integer to Indian words.
 * Handles crores, lakhs, thousands, and hundreds.
 */
function integerToWords(n: number): string {
  if (n === 0) return "Zero";
  if (n < 0) throw new Error("integerToWords: negative numbers not supported");

  const parts: string[] = [];

  const crore = Math.floor(n / 10000000);
  if (crore > 0) {
    parts.push(convertHundreds(crore) + " Crore");
    n = n % 10000000;
  }

  const lakh = Math.floor(n / 100000);
  if (lakh > 0) {
    parts.push(convertHundreds(lakh) + " Lakh");
    n = n % 100000;
  }

  const thousand = Math.floor(n / 1000);
  if (thousand > 0) {
    parts.push(convertHundreds(thousand) + " Thousand");
    n = n % 1000;
  }

  if (n > 0) {
    parts.push(convertHundreds(n));
  }

  return parts.join(" ").trim();
}

/**
 * Converts an INR amount to full Indian currency words.
 * @param amount  Amount in rupees (may have decimals for paise).
 * @returns       e.g. "Rupees One Thousand One Hundred Eighty Only"
 *                or   "Rupees One Thousand One Hundred Eighty and Fifty Paise Only"
 */
export function amountToWords(amount: number): string {
  if (isNaN(amount) || amount < 0) return "Rupees Zero Only";

  // Separate rupees and paise using integer arithmetic to avoid floating-point issues
  const totalPaise = Math.round(amount * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  let result = "Rupees " + integerToWords(rupees);
  if (paise > 0) {
    result += " and " + integerToWords(paise) + " Paise";
  }
  result += " Only";

  return result;
}

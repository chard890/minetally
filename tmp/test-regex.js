
const validKeywords = ["mine", "grab", "steal", "m", "g", "s"];
const cancelKeywords = ["cancel", "pass", "mine off", "c"];

function normalizeText(text) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function hasKeyword(normalizedText, keyword) {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`(^|[\\s\\-\\)（\\(])(${escapedKeyword})([\\s\\-0-9\\(（\\)]|$)`, "i");
  return matcher.test(normalizedText);
}

function parseText(message) {
  const normalized = normalizeText(message);
  
  const isCancelComment = cancelKeywords.some((keyword) => hasKeyword(normalized, keyword));
  const matchedClaimWords = validKeywords.filter((keyword) => hasKeyword(normalized, keyword));

  if (matchedClaimWords.length === 0) {
    return { isCancelComment, isValidClaim: false };
  }

  return {
    claimWord: matchedClaimWords[0],
    isCancelComment,
    isValidClaim: !isCancelComment,
  };
}

const testCases = [
  "M", "m", "Mine", "mine", "M-100", "M100", "Grab", "S", "steal",
  "M next", "cancel", "pass", "C", "hammer", "some msg"
];

console.log('--- REGEX & PARSING TEST ---');
testCases.forEach(msg => {
  const res = parseText(msg);
  console.log(`Msg: [${msg}] -> Valid: ${res.isValidClaim}, Word: ${res.claimWord}, Cancel: ${res.isCancelComment}`);
});

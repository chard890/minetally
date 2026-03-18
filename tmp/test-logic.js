
const { commentParserService } = require('./src/services/comment-parser.service');
const { claimService } = require('./src/services/claim.service');

const mockSettings = {
  validClaimKeywords: ["mine", "grab", "steal", "m", "g", "s"],
  cancelKeywords: ["cancel", "pass", "mine off", "c"]
};

const testMessages = [
  "Mine",
  "M",
  "m",
  "mine",
  "M-100",
  "M100",
  "Grab",
  "mine off",
  "hammer"
];

console.log('--- Testing CommentParserService.parseText ---');
testMessages.forEach(msg => {
  const result = commentParserService.parseText(msg, mockSettings);
  console.log(`Msg: "${msg}" | Valid: ${result.isValidClaim} | Word: ${result.claimWord}`);
});

const mockComments = [
  {
    id: "c1",
    from: { id: "u1", name: "User 1" },
    message: "M",
    created_time: new Date().toISOString()
  },
  {
    id: "c2",
    from: { id: "u2", name: "User 2" },
    message: "Mine",
    created_time: new Date(Date.now() + 1000).toISOString()
  },
  {
      id: "c3",
      from: { id: "", name: "Unknown" },
      message: "M",
      created_time: new Date(Date.now() + 2000).toISOString()
  }
];

console.log('\n--- Testing ClaimService.processClaims ---');
const result = claimService.processClaims(mockComments, mockSettings);
console.log('Winner:', result.winner?.buyerName || 'None');
result.processedComments.forEach(pc => {
  console.log(`Comment: "${pc.message}" | Valid: ${pc.isValidClaim} | Tags: ${pc.tags.join(', ')}`);
});

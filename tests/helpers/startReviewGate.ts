export const expectedReviewDecisionIds = [
  'approve_next_slice',
  'request_changes',
  'review_version_candidate',
] as const;

export const expectedReviewDecisionReplies = [
  'Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
  'Changes requested: address the review feedback first, update proof, then stop for another review.',
  'Prepare a version-candidate review only. Do not publish, deploy, push, merge, or bump the version.',
] as const;

export const expectedReviewReplyTextLines = [
  `Approve next slice: ${expectedReviewDecisionReplies[0]}`,
  `Request changes: ${expectedReviewDecisionReplies[1]}`,
  `Review version candidate: ${expectedReviewDecisionReplies[2]}`,
] as const;

export const expectedReviewReplyLines = [
  `- ${expectedReviewReplyTextLines[0]}`,
  `- ${expectedReviewReplyTextLines[1]}`,
  `- ${expectedReviewReplyTextLines[2]}`,
] as const;

export const expectedReviewPromptReplies = [
  `Reviewer replies: Approve next slice => ${expectedReviewDecisionReplies[0]}`,
  `Request changes => ${expectedReviewDecisionReplies[1]}`,
  `Review version candidate => ${expectedReviewDecisionReplies[2]}`,
] as const;

export const expectedReviewReplyQuotes = [
  `Reply: "${expectedReviewDecisionReplies[0]}"`,
  `Reply: "${expectedReviewDecisionReplies[1]}"`,
  `Reply: "${expectedReviewDecisionReplies[2]}"`,
] as const;

export const expectedReviewPolicy = {
  approvalRequired: true,
  blockedActions: ['next_slice', 'release', 'publish', 'deploy', 'push', 'merge', 'version_bump'],
  summary:
    'Explicit reviewer approval is required before another slice, release, publish, deploy, push, merge, or version bump.',
} as const;

-- AlterTable
ALTER TABLE "public"."individual_differences" ADD COLUMN     "aiConfidenceSlider" INTEGER,
ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "aiSummaryAccuracy" TEXT,
ADD COLUMN     "ccsCausationMean" DOUBLE PRECISION,
ADD COLUMN     "ccsEfficacyMean" DOUBLE PRECISION,
ADD COLUMN     "ccsMeanScored" DOUBLE PRECISION,
ADD COLUMN     "ccsOccurrenceMean" DOUBLE PRECISION,
ADD COLUMN     "ccsSeriousnessMean" DOUBLE PRECISION,
ADD COLUMN     "ccsTrustMean" DOUBLE PRECISION,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "economicIssues" INTEGER,
ADD COLUMN     "mindChangeDirection" TEXT,
ADD COLUMN     "mindChangeNoChange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mindChangeOtherText" TEXT,
ADD COLUMN     "prolificId" TEXT,
ADD COLUMN     "socialIssues" INTEGER,
ADD COLUMN     "surveyCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."conversation_states" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sessionId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'exploration',
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "topicTurnCount" INTEGER NOT NULL DEFAULT 0,
    "lastTopic" TEXT,
    "minimalResponseCount" INTEGER NOT NULL DEFAULT 0,
    "substantiveResponseCount" INTEGER NOT NULL DEFAULT 0,
    "exhaustionSignals" INTEGER NOT NULL DEFAULT 0,
    "lastUserResponse" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversation_states_conversationId_key" ON "public"."conversation_states"("conversationId");

-- AddForeignKey
ALTER TABLE "public"."conversation_states" ADD CONSTRAINT "conversation_states_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

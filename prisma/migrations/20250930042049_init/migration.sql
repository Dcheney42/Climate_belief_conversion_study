-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "participantId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "appVersion" TEXT,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "turn" INTEGER,
    "role" TEXT,
    "content" TEXT,
    "timestamp" TIMESTAMP(3),
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."individual_differences" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "political7" INTEGER,
    "confidence0_100" INTEGER,
    "age" INTEGER,
    "gender" TEXT,
    "education" TEXT,
    "viewsChanged" TEXT,

    CONSTRAINT "individual_differences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_sessionId_idx" ON "public"."messages"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "individual_differences_sessionId_key" ON "public"."individual_differences"("sessionId");

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."individual_differences" ADD CONSTRAINT "individual_differences_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

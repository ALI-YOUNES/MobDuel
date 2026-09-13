-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "email" TEXT,
ADD COLUMN     "password" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_key" ON "Player"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Player_email_key" ON "Player"("email");

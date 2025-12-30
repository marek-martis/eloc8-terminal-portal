-- AlterTable
ALTER TABLE "stale_device_records" ADD COLUMN     "device_profile_id" TEXT;

-- CreateTable
CREATE TABLE "device_profiles" (
    "id" TEXT NOT NULL,
    "thingsboard_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_profiles_thingsboard_id_key" ON "device_profiles"("thingsboard_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_profiles_name_key" ON "device_profiles"("name");

-- AddForeignKey
ALTER TABLE "stale_device_records" ADD CONSTRAINT "stale_device_records_device_profile_id_fkey" FOREIGN KEY ("device_profile_id") REFERENCES "device_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

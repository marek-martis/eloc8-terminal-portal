-- CreateTable
CREATE TABLE "stale_device_snapshots" (
    "id" TEXT NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "stale_days" INTEGER NOT NULL DEFAULT 2,
    "total_devices" INTEGER NOT NULL,
    "stale_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stale_device_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stale_device_records" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "thingsboard_device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "device_type" TEXT NOT NULL,
    "last_activity_at" TIMESTAMP(3),
    "days_since_activity" INTEGER NOT NULL,
    "first_seen_stale_at" TIMESTAMP(3) NOT NULL,
    "consecutive_stale_days" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "stale_device_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stale_device_snapshots_snapshot_date_key" ON "stale_device_snapshots"("snapshot_date");

-- CreateIndex
CREATE INDEX "stale_device_snapshots_snapshot_date_idx" ON "stale_device_snapshots"("snapshot_date");

-- CreateIndex
CREATE INDEX "stale_device_records_snapshot_id_idx" ON "stale_device_records"("snapshot_id");

-- CreateIndex
CREATE INDEX "stale_device_records_thingsboard_device_id_idx" ON "stale_device_records"("thingsboard_device_id");

-- AddForeignKey
ALTER TABLE "stale_device_records" ADD CONSTRAINT "stale_device_records_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "stale_device_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

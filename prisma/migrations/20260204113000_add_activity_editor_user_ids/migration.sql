-- Add extra editors for an activity (exception channel)
ALTER TABLE "activities" ADD COLUMN "editorUserIds" JSONB;

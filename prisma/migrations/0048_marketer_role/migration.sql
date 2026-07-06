-- Add MARKETER to the AppRole enum so marketers can have their own login role.
ALTER TYPE "AppRole" ADD VALUE IF NOT EXISTS 'MARKETER';

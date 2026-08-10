import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAuthorizedUser } from "@/lib/dal";

/**
 * Token endpoint for client-direct resume uploads.
 *
 * Client-direct because Vercel functions cap request bodies at 4.5 MB — routing
 * a resume through our own API would fail outright above that. The browser
 * uploads straight to Blob; this route only signs the request.
 *
 * URLs are public-but-unguessable (random suffix). Resumes are PII, so the URL
 * is only ever surfaced to the applicant themselves, reviewers, and — with the
 * applicant's explicit opt-in — sponsors.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const authz = await getAuthorizedUser();
        if (!authz) throw new Error("Sign in to upload a resume");
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 5 * 1024 * 1024,
          addRandomSuffix: true,
          allowOverwrite: true,
          tokenPayload: authz.user.id,
        };
      },
      // Fires on Vercel after the browser finishes uploading (not on localhost).
      // The client writes the URL into the draft via autosave, so nothing is
      // needed here — but the hook must exist.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}

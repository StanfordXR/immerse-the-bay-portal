import { notFound } from "next/navigation";
import { LogoLab } from "./logo-lab";

/** Dev-only logo asset generator. 404s in production. */
export default function LogoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <LogoLab />;
}

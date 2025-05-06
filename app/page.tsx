import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/keyword-volume");
  return null;
}

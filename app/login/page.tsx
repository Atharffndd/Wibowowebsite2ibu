import { redirect } from "next/navigation";

// Website tanpa login: halaman lama /login diarahkan ke dashboard.
export default function LoginPage() {
  redirect("/");
}

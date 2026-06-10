import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { devAuthEnabled } from "@/lib/auth";

export default function SignUpPage() {
  if (devAuthEnabled()) redirect("/dashboard");
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <SignUp />
    </main>
  );
}

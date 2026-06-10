import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { devAuthEnabled } from "@/lib/auth";

export default function SignInPage() {
  if (devAuthEnabled()) redirect("/dashboard");
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <SignIn />
    </main>
  );
}

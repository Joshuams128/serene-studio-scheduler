"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui";

export default function LogoutButton() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        router.push("/login");
        // The session cookie is gone — drop the cached dashboard payload too.
        router.refresh();
      }}
    >
      Log out
    </Button>
  );
}

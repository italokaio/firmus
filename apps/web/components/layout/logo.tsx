import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <>
      <Image
        src="/firmus-logo-light.png"
        alt="Firmus"
        width={317}
        height={108}
        priority
        className={cn("block w-auto dark:hidden", className)}
      />
      <Image
        src="/firmus-logo-dark.png"
        alt="Firmus"
        width={317}
        height={108}
        priority
        className={cn("hidden w-auto dark:block", className)}
      />
    </>
  );
}

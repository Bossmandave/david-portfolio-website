import { BootSequence } from "@/modules/boot/BootSequence";
import { SystemModule } from "@/modules/system/SystemModule";

export default function Home() {
  return (
    <>
      {/* The hero is server-rendered underneath the boot overlay, not behind a
          loading gate — so it is in the DOM, indexable, and already painted the
          moment the overlay lifts. */}
      <SystemModule />
      <BootSequence />
    </>
  );
}

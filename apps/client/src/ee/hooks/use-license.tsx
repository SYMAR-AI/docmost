import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";

export const useLicense = () => {
  const [currentUser] = useAtom(currentUserAtom);
  // License gate bypassed — all plugin features enabled
  return { hasLicenseKey: true };
};

export default useLicense;

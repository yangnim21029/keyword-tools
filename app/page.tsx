import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/keyword-mapping');
  return null;
}

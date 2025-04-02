import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/tools/keyword');
  // Return null or a simple loading indicator if needed, 
  // although redirect typically happens server-side before rendering.
  return null;
}
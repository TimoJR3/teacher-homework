import { SignupForm } from "@/components/signup-form";

export default async function StudentSignupPage(props: PageProps<"/signup/student">) {
  const { error } = await props.searchParams;
  return <SignupForm role="student" error={error} />;
}

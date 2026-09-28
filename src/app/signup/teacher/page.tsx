import { SignupForm } from "@/components/signup-form";

export default async function TeacherSignupPage(props: PageProps<"/signup/teacher">) {
  const { error } = await props.searchParams;
  return <SignupForm role="teacher" error={error} />;
}

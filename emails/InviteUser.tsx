import {
  Body,
  Button,
  Container,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import * as React from "react";

interface VercelInviteUserEmailProps {
  username: string;
  invitedByUsername: string;
  invitedUserPassword: string;
  userLanguage: string;
  appUrl: string;
}

export const InviteUserEmail = ({
  username,
  invitedByUsername,
  invitedUserPassword,
  userLanguage,
  appUrl,
}: VercelInviteUserEmailProps) => {
  const previewText =
    userLanguage === "en"
      ? `You have been invited by ${invitedByUsername} to BasaltCRM app`
      : `Byl jste pozván uživatelem ${invitedByUsername} do aplikace BasaltCRM`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded-lg my-[40px] mx-auto p-[20px] w-[465px]">
            <Section className="mt-[32px]">
              <Img
                src={`${appUrl}/BasaltCRMWide.png`}
                width="150"
                height="42"
                alt="BasaltCRM"
                className="my-0 mx-auto"
              />
            </Section>
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              {userLanguage === "en"
                ? "Join the team on BasaltCRM"
                : "Připojte se k týmu na BasaltCRM"}
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
              {userLanguage === "en"
                ? `Hello ${username},`
                : `Dobrý den ${username},`}
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
              <strong>{invitedByUsername}</strong>
              {userLanguage === "en"
                ? ` has invited you to the `
                : ` Vás pozval ke spolupráci na `}
              <strong>{process.env.NEXT_PUBLIC_APP_NAME}</strong>
              {userLanguage === "en" ? " team." : " týmu."}
            </Text>
            <Section>
              <Row>
                <Column align="center">
                  <Img
                    className="rounded-full"
                    src={`${appUrl}/images/invite-avatar.png`}
                    width="64"
                    height="64"
                    alt="User Avatar"
                  />
                </Column>
              </Row>
            </Section>
            <Text className="text-black text-[14px] leading-[24px]">
              {userLanguage === "en"
                ? `To accept this invitation, click the button below. Use this password to login:`
                : `Pro přijetí této pozvánky klikněte na tlačítko níže. Použijte toto heslo pro přihlášení:`}
            </Text>

            <Section className="bg-gray-100 rounded-md p-4 text-center my-4 border border-gray-200">
              <Text className="text-xl font-mono font-bold tracking-wider m-0">
                {invitedUserPassword}
              </Text>
            </Section>

            <Section className="text-center mt-[32px] mb-[32px]">
              <Button
                className="bg-[#000000] rounded-md text-white py-3 px-5 text-[14px] font-semibold no-underline text-center shadow-md"
                href={`${appUrl}/${userLanguage}/sign-in`}
              >
                {userLanguage === "en" ? "Login to Dashboard" : "Přihlásit se"}
              </Button>
            </Section>
            <Text className="text-black text-[14px] leading-[24px]">
              {userLanguage === "en"
                ? `or copy and paste this URL into your browser:`
                : `nebo zkopírujte a vložte tento odkaz do svého prohlížeče:`}{" "}
              <Link
                href={`${appUrl}/${userLanguage}/sign-in`}
                className="text-blue-600 no-underline"
              >
                {`${appUrl}/${userLanguage}/sign-in`}
              </Link>
            </Text>
            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
            <Text className="text-[#666666] text-[12px] leading-[24px]">
              {userLanguage === "en"
                ? `This invitation was intended for `
                : `Toto pozvání bylo určeno pro `}
              <span className="text-black">{username}. </span>
              {userLanguage === "en"
                ? "If you were not expecting this invitation, you can ignore this email."
                : "Pokud jste toto pozvání neočekávali, můžete tento e-mail ignorovat."}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default InviteUserEmail;

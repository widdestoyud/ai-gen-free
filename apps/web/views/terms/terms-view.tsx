"use client";

import { Container, Stack, Title, Text, Paper, Button, Group, Divider, Badge, List } from "@mantine/core";
import Link from "next/link";

export function TermsPageView() {
  return (
    <Container size="md" py={60}>
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Button
            component={Link}
            href="/"
            variant="subtle"
            color="gray"
            size="sm"
            leftSection={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            }
          >
            Back to Home
          </Button>
          <Badge variant="outline" color="blue">
            Last updated: 4 September 2026
          </Badge>
        </Group>

        <div>
          <Title order={1} fz={{ base: "1.8rem", sm: "2.4rem" }} fw={900} mb="xs">
            Terms of Service
          </Title>
          <Text c="dimmed" size="sm">
            These terms are an agreement between you and satulabs.id (&quot;we&quot;, &quot;us&quot;) covering your use of the satulabs.id studio at{" "}
            <Link href="/" style={{ color: "#60a5fa" }}>
              https://satulabs.id
            </Link>{" "}
            (the &quot;Service&quot;). By creating an account or using the Service you accept them. If you do not, do not use the Service.
          </Text>
        </div>

        <Divider />

        <Paper p="xl" withBorder radius="md" bg="var(--mantine-color-dark-8, #14171f)">
          <Stack gap="xl">
            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                1. What the Service is
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                satulabs.id is a studio that gives you one account and one Sparks balance across chat, image, video, music and editing models. We do not build the models. We buy capacity from third-party model providers and pass your instructions to them. What comes back is shaped almost entirely by the model you chose and the instructions you wrote.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                2. Output is generated, not verified
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Everything the Service returns is produced by a statistical model. It can be wrong, invented, offensive, or unlike anything you asked for. We do not review it before you see it, and we make no promise that any particular request will succeed, that any model will behave a particular way, or that a result will resemble a previous one. Do not rely on output as fact, and do not treat it as professional advice of any kind.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                3. Eligibility
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                The Service is for adults. You must be at least 18, or older if that is the age of majority where you live, and legally able to enter into this agreement. Do not create an account for anyone else, and do not let a minor use yours. If you use the Services on behalf of a company or other entity, you are authorized to bind that entity to these Terms. You will comply with all applicable laws, regulations, and these Terms.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                4. Your account
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Keep your credentials to yourself and tell us promptly if you think someone else has them. Everything done through your account is treated as done by you. One person, one account: do not register repeatedly to collect free allowances.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                5. Sparks, packages and payment
              </Title>
              <Stack gap="xs">
                <Text size="sm" c="gray.3" lh={1.6}>
                  <strong>Sparks Billing Unit:</strong> Sparks are the digital unit the Service bills in. What an action costs in Sparks is displayed before you initiate it and is deducted only when the generation or processing succeeds. If a generation fails due to a system or provider error, the held Sparks are refunded automatically back to your account balance.
                </Text>
                <Text size="sm" c="gray.3" lh={1.6}>
                  <strong>Packages &amp; No Expiration:</strong> Sparks are purchased as one-off packages. Sparks do not expire and remain active in your account balance for as long as your account remains open.
                </Text>
                <Text size="sm" c="gray.3" lh={1.6}>
                  <strong>Payment Method &amp; Manual Admin Curation:</strong> Currently, the platform exclusively supports direct bank and manual payment methods. Orders are processed through manual verification and curation by our administrative team. Upon successful confirmation and approval of your payment proof by the admin, the corresponding Sparks quota for your chosen package will be automatically credited to your account balance.
                </Text>
                <Text size="sm" c="gray.3" lh={1.6}>
                  <strong>No Cash Refunds &amp; Finality of Purchase:</strong> All purchases of Sparks packages are final and non-refundable. By initiating and completing a payment, you expressly agree and acknowledge that purchased Sparks cannot be returned, cancelled, or refunded in fiat currency (real money).
                </Text>
                <Text size="sm" c="gray.3" lh={1.6}>
                  <strong>No Refunds for Used Sparks:</strong> Sparks and usage-based services are consumed upon successful generation or processing. Used, partially used, or consumed Sparks are strictly non-refundable under any circumstances.
                </Text>
                <Text size="sm" c="gray.3" lh={1.6}>
                  <strong>Nature of Sparks:</strong> Sparks are a prepaid digital entitlement to use features on the Service. They have no monetary or cash value, cannot be redeemed or exchanged for money, and cannot be transferred, sold, or assigned between accounts.
                </Text>
                <Text size="sm" c="gray.3" lh={1.6}>
                  <strong>Pricing &amp; Payment Disputes:</strong> Package prices and Spark conversion rates can change over time; price adjustments will never affect Sparks you have already acquired. If a payment proof is found to be invalid, fraudulent, or reversed, we may reject the order, suspend your account access, and revoke any associated Sparks.
                </Text>
              </Stack>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                6. What you may not do
              </Title>
              <Text size="sm" c="gray.3" lh={1.6} mb="xs">
                Regardless of how permissive the Service is, these are absolute and are enforced without warning:
              </Text>
              <List spacing="xs" size="sm" c="gray.3" pl="md">
                <List.Item>
                  Any sexual content involving a minor, or any content that presents a real person as a minor. This includes generated, drawn, animated and simulated material without exception.
                </List.Item>
                <List.Item>
                  Sexual or intimate depictions of a real, identifiable person without that person&apos;s consent, including face swaps and likeness transfers.
                </List.Item>
                <List.Item>
                  Content that presents a real person as saying or doing something they did not, where the purpose or likely effect is to deceive.
                </List.Item>
                <List.Item>
                  Material that facilitates serious violent harm, such as workable instructions for weapons capable of mass casualties.
                </List.Item>
                <List.Item>
                  Anything unlawful where you are, or that infringes someone else&apos;s rights.
                </List.Item>
                <List.Item>
                  Attacking the Service: probing it, overloading it, circumventing quotas, reselling access, scraping it, or using it to train a competing model.
                </List.Item>
              </List>
              <Text size="sm" c="gray.3" lh={1.6} mt="xs">
                We may suspend or close an account for any of the above, and we report the first category to the appropriate authorities.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                7. Your content, and who is responsible for it
              </Title>
              <Text size="sm" c="gray.3" lh={1.6} mb="xs">
                You keep whatever rights you have in the instructions you write and the results you generate, subject to the rights of the model providers and of anyone whose material you supplied. You are solely responsible for what you make: for its legality, for where you publish it, and for the consequences. We retain the text of your prompts and chat messages, while generated and uploaded media are stored temporarily in accordance with Section 8.
              </Text>
              <Text size="sm" c="gray.3" lh={1.6} mb="xs">
                You confirm you have the rights to anything you upload as an input, including any photograph of a person, and that you have that person&apos;s consent.
              </Text>
              <Text size="sm" c="gray.3" lh={1.6}>
                To the maximum extent the law permits, we accept no liability for anything generated through the Service or for any use made of it.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                8. What we store &amp; data retention
              </Title>
              <Text size="sm" c="gray.3" lh={1.6} mb="xs">
                <strong>Text Prompts &amp; Conversations:</strong> Our servers hold your account, your Sparks balance, payment and transaction records, a metering row for each generation, and the text of your prompts and chat messages. This text is kept indefinitely so that we can investigate abuse, enforce these Terms, and comply with lawful demands. Only authorized administrators can read it, and every read is logged. You may ask us to erase it in accordance with our Privacy Policy.
              </Text>
              <Text size="sm" c="gray.3" lh={1.6}>
                <strong>Media Retention (14-Day Storage):</strong> Generated media (images and videos) and uploaded media are stored in our private object storage for a maximum of <strong>14 (fourteen) days</strong>. After 14 days, media files are automatically and permanently deleted from the servers for storage efficiency. Users are strongly advised to download and backup their generated and uploaded media to their own devices before the 14-day period expires.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                9. Third-party models
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Generations are executed by third-party providers, each with its own rules. Some models apply their own filtering that we cannot switch off, and a provider may refuse a request or withdraw a model at any time. Where a model is marked as open in the picker, that reflects what the provider states, not a guarantee by us. Your use of the Service is also subject to those providers&apos; terms.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                10. Availability and changes
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                The Service is provided as-is and as-available, without warranties of any kind. Models, prices, limits and features change, sometimes without notice, and we may suspend or discontinue any part of the Service. Any changes or updates regarding packages, pricing, or system features will be provided directly within the system.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                11. Limitation of liability
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                To the maximum extent the law permits, we are not liable for indirect, incidental, special or consequential loss, nor for lost profits, lost data or lost opportunity. Our total liability for any claim is capped at the greater of the amount you paid us in the three months before the claim arose, or fifty United States dollars. Nothing here excludes liability that cannot legally be excluded.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                12. Indemnity
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                You will cover us against claims, losses and reasonable legal costs arising from your use of the Service, your content, or your breach of these terms.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                13. Changes to these terms
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                We may update these terms. Material changes are posted here with a new date, and continuing to use the Service after that means you accept them.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                14. General
              </Title>
              <Text size="sm" c="gray.3" lh={1.6} mb="xs">
                If a provision is unenforceable, the rest stands. Our not enforcing something is not a waiver of it. You may not assign this agreement; we may, on notice, to a successor. These terms and the Privacy Policy are the entire agreement between us.
              </Text>
              <Text size="sm" c="gray.3" lh={1.6}>
                The English version of these terms is the authoritative one. Translations elsewhere in the product are provided for convenience.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                15. Contact
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                For questions regarding these Terms of Service, account inquiries, billing assistance, or technical support, you can reach out via our official support channels or manage your Sparks packages and service requests directly inside your application workspace at{" "}
                <Link href="/app" style={{ color: "#60a5fa" }}>
                  /app
                </Link>.
              </Text>
            </section>
          </Stack>
        </Paper>

        <Group justify="center" mt="md">
          <Button
            component={Link}
            href="/"
            variant="gradient"
            gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
            size="md"
          >
            I Understand &amp; Back to Home
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}


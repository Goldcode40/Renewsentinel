export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: March 13, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-6 text-gray-700">

          <section>
            <h2 className="text-xl font-semibold">1. Company Information</h2>
            <p>
              RenewSentinel is owned and operated by Guardara Technologies Inc.
              ("Company", "we", "us", or "our"), a corporation registered in
              New Brunswick, Canada.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Acceptance of Terms</h2>
            <p>
              By accessing or using RenewSentinel, you agree to be bound by
              these Terms of Service. If you do not agree to these Terms,
              you must not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Description of Service</h2>
            <p>
              RenewSentinel provides tools to help organizations track licenses,
              certifications, insurance documents, subcontractor documentation,
              renewal reminders, and proof documentation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. No Legal or Regulatory Advice</h2>
            <p>
              RenewSentinel is a software tool designed to assist with document
              organization and reminders. It does not provide legal,
              regulatory, compliance, tax, or professional advice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. User Responsibilities</h2>
            <p>
              Users are solely responsible for ensuring compliance with all
              applicable laws, regulations, licensing requirements, insurance
              obligations, and renewal deadlines. The Company does not guarantee
              the accuracy or completeness of any compliance requirement or date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Guardara Technologies Inc.
              shall not be liable for any indirect, incidental, consequential,
              special, or punitive damages arising from use of the service.
              Total liability shall not exceed the total amount paid by the user
              for the service in the preceding 12 months.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Guardara Technologies Inc.,
              its officers, employees, and affiliates from any claims, damages,
              or expenses arising from your use of the service or violation
              of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Subscription Billing</h2>
            <p>
              Certain features of RenewSentinel require a paid subscription.
              Billing is processed securely through Stripe. By subscribing,
              you authorize recurring billing according to the plan selected.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Intellectual Property</h2>
            <p>
              All software, branding, and content associated with RenewSentinel
              are the intellectual property of Guardara Technologies Inc.
              Unauthorized copying or redistribution is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Governing Law</h2>
            <p>
              These Terms shall be governed by and interpreted in accordance
              with the laws of the Province of New Brunswick, Canada,
              without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Changes to Terms</h2>
            <p>
              Guardara Technologies Inc. reserves the right to update these
              Terms at any time. Continued use of the service after changes
              constitutes acceptance of the updated Terms.
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}

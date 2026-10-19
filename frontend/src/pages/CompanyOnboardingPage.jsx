import SessionAccountCard from '@/features/authentication/components/SessionAccountCard'
import CompanyOnboardingFlow from '@/features/company-onboarding/components/CompanyOnboardingFlow'

function CompanyOnboardingPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <CompanyOnboardingFlow
        accountPanel={
          <SessionAccountCard
            logoutMessage="Đăng nhập lại bất cứ lúc nào để tiếp tục quy trình onboarding doanh nghiệp."
            roleLabel="Company Manager"
          />
        }
      />
    </section>
  )
}

export default CompanyOnboardingPage

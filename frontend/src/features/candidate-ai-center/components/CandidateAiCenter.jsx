import { useMemo } from 'react'

import useCandidateRecommendations from '@/features/candidate-dashboard/hooks/useCandidateRecommendations'
import useCandidateCvs from '@/features/candidate-cvs/hooks/useCandidateCvs'
import { CANDIDATE_CV_STATUS } from '@/utils/constant'

import AiJobRecommendationPanel from './AiJobRecommendationPanel'

function CandidateAiCenter() {
  const { loading: cvsLoading, cvs, error: cvsError } = useCandidateCvs()
  const recommendations = useCandidateRecommendations()

  const defaultCv = useMemo(
    () =>
      cvs.find(
        (cv) => cv.isDefault && cv.status === CANDIDATE_CV_STATUS.ACTIVE,
      ) ?? null,
    [cvs],
  )

  return (
    <div className="mx-auto w-full max-w-[80rem] space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">Ứng viên · AI</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Gợi ý việc làm phù hợp
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          Hệ thống AI phân tích CV mặc định của bạn để đề xuất những việc làm đang tuyển phù hợp nhất.
        </p>
      </header>

      <AiJobRecommendationPanel
        cvsError={cvsError}
        cvsLoading={cvsLoading}
        defaultCv={defaultCv}
        error={recommendations.error}
        onRecommend={recommendations.load}
        recommendations={recommendations.recommendations}
        status={recommendations.status}
      />
    </div>
  )
}

export default CandidateAiCenter

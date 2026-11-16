import { useEffect, useState } from 'react'

import { getOwnCandidateCvApi, listOwnCandidateCvsApi } from '@/apis/candidate-cv.api'
import { getOwnCandidateProfileApi } from '@/apis/candidate-profile.api'
import { CANDIDATE_CV_SOURCE_TYPE } from '@/utils/constant'

import { computeProfilePageCompletion, emptyGeneratedContent } from '../utils'

function pickEditableCv(cvs) {
  const generated = cvs.filter((cv) => cv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED)
  return generated.find((cv) => cv.isDefault) ?? generated[0] ?? null
}

function useCandidateProfile() {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({
    key: null,
    profile: null,
    cvs: [],
    contentCv: null,
    content: emptyGeneratedContent(),
    error: null,
  })

  useEffect(() => {
    let active = true
    const key = String(loadAttempt)

    ;(async () => {
      try {
        const [profileResponse, cvsResponse] = await Promise.all([
          getOwnCandidateProfileApi(),
          listOwnCandidateCvsApi(),
        ])
        const cvs = cvsResponse.cvs ?? []
        const summary = pickEditableCv(cvs)
        let contentCv = null
        let content = emptyGeneratedContent()

        if (summary) {
          const detailResponse = await getOwnCandidateCvApi(summary.id)
          contentCv = detailResponse.cv ?? null
          content = contentCv?.generatedContent ?? emptyGeneratedContent()
        }

        if (active) {
          setView({
            key,
            profile: profileResponse.profile ?? null,
            cvs,
            contentCv,
            content,
            error: null,
          })
        }
      } catch (error) {
        if (active) {
          setView({
            key,
            profile: null,
            cvs: [],
            contentCv: null,
            content: emptyGeneratedContent(),
            error,
          })
        }
      }
    })()

    return () => {
      active = false
    }
  }, [loadAttempt])

  const completion = computeProfilePageCompletion({
    profile: view.profile,
    content: view.content,
    hasDefaultCv: view.cvs.some((cv) => cv.isDefault),
  })

  return {
    loading: view.key !== String(loadAttempt),
    profile: view.profile,
    cvs: view.cvs,
    contentCv: view.contentCv,
    content: view.content,
    completion,
    error: view.error,
    canEditContent: Boolean(
      view.contentCv && view.contentCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    ),
    reload: () => setLoadAttempt((current) => current + 1),
    setLocalContent: (content) =>
      setView((current) => ({
        ...current,
        content,
      })),
    setLocalProfile: (profile) =>
      setView((current) => ({
        ...current,
        profile,
      })),
  }
}

export default useCandidateProfile

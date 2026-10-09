import RootLayout from '@/layouts/RootLayout'
import HomePage from '@/pages/HomePage'

const publicRoutes = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
    ],
  },
]

export default publicRoutes

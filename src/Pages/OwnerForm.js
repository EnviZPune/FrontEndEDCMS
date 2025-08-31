import React from 'react'
import { useSearchParams } from 'react-router-dom'
import RegisterBusinessForm from '../Components/RegisterFormBusiness'

export default function OwnerForm() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  return (
    <div className="page-wrapper">
      <h1>Owner Registration</h1>
      <RegisterBusinessForm token={token} />
    </div>
  )
}

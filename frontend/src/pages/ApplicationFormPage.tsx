// ============================================================
// APPLICATION FORM PAGE
// Multi-step form: Business → Guarantor → Loan Request
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Building2, User, DollarSign, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { applicationsApi } from '../api/applications';
import { underwritingApi } from '../api/underwriting';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import type { ApplicationFormData } from '../types';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY'
].map(s => ({ value: s, label: s }));

const INDUSTRIES = [
  'Construction','Medical','Dental','Veterinary','Healthcare',
  'Transportation','Trucking','Manufacturing','Agriculture',
  'Food Service','Restaurant','Retail','Technology',
  'Automotive Repair','Landscaping','Janitorial','Logistics',
  'Oil Gas','Cannabis','Gaming','Gambling','Real Estate','Other'
].map(i => ({ value: i, label: i }));

const EQUIPMENT_TYPES = [
  'Construction Equipment','Forklift','Medical Equipment',
  'Dental Equipment','Trucking','Semi Truck','Trailer',
  'Agricultural Equipment','Machine Tools','Industrial Machinery',
  'Vocational Trucks','Automotive Repair Equipment',
  'Janitorial Equipment','Lawn Equipment','Restaurant Equipment',
  'Audio Visual','Office Equipment','Other'
].map(e => ({ value: e, label: e }));

const steps = [
  { id: 1, label: 'Business Info', icon: Building2 },
  { id: 2, label: 'Guarantor Credit', icon: User },
  { id: 3, label: 'Loan Request', icon: DollarSign },
];

export default function ApplicationFormPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ApplicationFormData>({
    defaultValues: {
      business: { is_startup: false },
      guarantor: {
        is_homeowner: false, is_us_citizen: true,
        has_bankruptcy: false, has_judgement: false,
        has_foreclosure: false, has_repossession: false,
        has_tax_lien: false, has_collections_last_3y: false,
      },
      loan_request: { is_private_party: false, is_titled_asset: false },
    }
  });

  const onSubmit = async (data: ApplicationFormData) => {
    setSubmitting(true);
    setError('');
    try {
      const app = await applicationsApi.create(data);
      const results = await underwritingApi.run(app.id);
      navigate(`/results/${app.id}`);
    } catch (e: any) {
      setError(e.message || 'Submission failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">New Loan Application</h1>
        <p className="text-zinc-600 mt-1">Fill in the details to find matching lenders</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              onClick={() => step > s.id && setStep(s.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                step === s.id
                  ? 'bg-emerald-600 text-white'
                  : step > s.id
                  ? 'bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200'
                  : 'bg-zinc-100 text-zinc-400 cursor-default'
              }`}
            >
              <s.icon className="w-4 h-4" />
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 text-zinc-300" />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Business */}
        {step === 1 && (
          <Card>
            <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Business Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Input label="Business Name *" {...register('business.business_name', { required: 'Required' })}
                  error={errors.business?.business_name?.message} placeholder="Acme Equipment LLC" />
              </div>
              <Select label="Business Type" {...register('business.business_type')}
                options={[{value:'LLC',label:'LLC'},{value:'Corporation',label:'Corporation'},{value:'Sole Proprietorship',label:'Sole Proprietorship'},{value:'Partnership',label:'Partnership'}]}
                placeholder="Select type" />
              <Select label="Industry" {...register('business.industry')}
                options={INDUSTRIES} placeholder="Select industry" />
              <Select label="State" {...register('business.state')}
                options={US_STATES} placeholder="Select state" />
              <Input label="Years in Business" type="number" step="0.5" min="0"
                {...register('business.years_in_business', { valueAsNumber: true })}
                placeholder="e.g. 5" />
              <Input label="Annual Revenue ($)" type="number" min="0"
                {...register('business.annual_revenue', { valueAsNumber: true })}
                placeholder="e.g. 500000" />
              <Input label="PayNet Score" type="number" min="0" max="999"
                {...register('business.paynet_score', { valueAsNumber: true })}
                placeholder="e.g. 680" hint="Business credit score" />
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="is_startup" {...register('business.is_startup')}
                  className="w-4 h-4 rounded text-emerald-600" />
                <label htmlFor="is_startup" className="text-sm text-zinc-700">
                  This is a startup (less than 2 years in business)
                </label>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button type="button" onClick={() => setStep(2)}>
                Next: Guarantor Info <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Guarantor */}
        {step === 2 && (
          <Card>
            <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" />
              Personal Guarantor
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Input label="First Name *" {...register('guarantor.first_name', { required: 'Required' })}
                error={errors.guarantor?.first_name?.message} />
              <Input label="Last Name *" {...register('guarantor.last_name', { required: 'Required' })}
                error={errors.guarantor?.last_name?.message} />
              <Input label="FICO Score *" type="number" min="300" max="850"
                {...register('guarantor.fico_score', { required: 'Required', valueAsNumber: true })}
                error={errors.guarantor?.fico_score?.message} placeholder="e.g. 720" />
              <Input label="Comparable Credit %" type="number" min="0" max="100"
                {...register('guarantor.comparable_credit_pct', { valueAsNumber: true })}
                placeholder="e.g. 85" hint="% of loan covered by comparable credit" />
              <Input label="Revolving Debt ($)" type="number" min="0"
                {...register('guarantor.revolving_debt', { valueAsNumber: true })}
                placeholder="e.g. 5000" />
              <Input label="Revolving + Unsecured Debt ($)" type="number" min="0"
                {...register('guarantor.revolving_plus_unsecured_debt', { valueAsNumber: true })}
                placeholder="e.g. 12000" />
              <Input label="Years at Current Residence" type="number" min="0"
                {...register('guarantor.years_at_residence', { valueAsNumber: true })}
                placeholder="e.g. 6" />

              <div className="col-span-2">
                <p className="text-sm font-medium text-zinc-700 mb-2">Credit Profile</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { field: 'is_homeowner', label: 'Homeowner' },
                    { field: 'is_us_citizen', label: 'US Citizen' },
                  ].map(({ field, label }) => (
                    <label key={field} className="flex items-center gap-2 text-sm text-zinc-700">
                      <input type="checkbox" {...register(`guarantor.${field}` as any)}
                        className="w-4 h-4 rounded text-emerald-600" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="col-span-2">
                <p className="text-sm font-medium text-zinc-700 mb-2">Derogatory Marks</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { field: 'has_bankruptcy', label: 'Bankruptcy' },
                    { field: 'has_judgement', label: 'Judgement' },
                    { field: 'has_foreclosure', label: 'Foreclosure' },
                    { field: 'has_repossession', label: 'Repossession' },
                    { field: 'has_tax_lien', label: 'Tax Lien' },
                    { field: 'has_collections_last_3y', label: 'Collections (3yr)' },
                  ].map(({ field, label }) => (
                    <label key={field} className="flex items-center gap-2 text-sm text-zinc-700">
                      <input type="checkbox" {...register(`guarantor.${field}` as any)}
                        className="w-4 h-4 rounded text-emerald-600" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {watch('guarantor.has_bankruptcy') && (
                <Input label="Years Since Bankruptcy" type="number" min="0"
                  {...register('guarantor.years_since_bankruptcy', { valueAsNumber: true })}
                  placeholder="e.g. 8" />
              )}
            </div>
            <div className="flex justify-between mt-6">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button type="button" onClick={() => setStep(3)}>
                Next: Loan Request <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Loan Request */}
        {step === 3 && (
          <Card>
            <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Loan Request
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Input label="Loan Amount ($) *" type="number" min="1"
                  {...register('loan_request.amount', { required: 'Required', valueAsNumber: true })}
                  error={errors.loan_request?.amount?.message} placeholder="e.g. 75000" />
              </div>
              <Input label="Loan Term (months)" type="number" min="12" max="84"
                {...register('loan_request.term_months', { valueAsNumber: true })}
                placeholder="e.g. 60" />
              <Select label="Equipment Type" {...register('loan_request.equipment_type')}
                options={EQUIPMENT_TYPES} placeholder="Select type" />
              <Input label="Equipment Year" type="number" min="1990" max={new Date().getFullYear()}
                {...register('loan_request.equipment_year', { valueAsNumber: true })}
                placeholder={`e.g. ${new Date().getFullYear() - 3}`} />
              <Input label="Equipment Mileage" type="number" min="0"
                {...register('loan_request.equipment_mileage', { valueAsNumber: true })}
                placeholder="e.g. 45000" />
              <div className="col-span-2 flex gap-6">
                {[
                  { field: 'is_private_party', label: 'Private Party Sale' },
                  { field: 'is_titled_asset', label: 'Titled Asset' },
                ].map(({ field, label }) => (
                  <label key={field} className="flex items-center gap-2 text-sm text-zinc-700">
                    <input type="checkbox" {...register(`loan_request.${field}` as any)}
                      className="w-4 h-4 rounded text-emerald-600" />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-700">{error}</div>
            )}

            <div className="flex justify-between mt-6">
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button type="submit" size="lg" loading={submitting}>
                {submitting ? 'Running Underwriting...' : 'Submit & Find Lenders'}
              </Button>
            </div>
          </Card>
        )}
      </form>
    </div>
  );
}

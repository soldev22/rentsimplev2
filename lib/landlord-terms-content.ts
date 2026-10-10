import type { PropertyRecord } from "@/lib/types/property"
import type { AuthUser } from "@/lib/types/user"

export type LandlordTermsBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }

export type LandlordTermsSection = {
  id: string
  heading: string
  note?: string
  blocks: LandlordTermsBlock[]
}

type TokenDefinition = { label: string; value?: string }

/**
 * RentSimple's own business details. Leave a value undefined to show it as a
 * highlighted [placeholder] in the terms until it is confirmed.
 */
export const LANDLORD_TERMS_AGENT_DETAILS: Record<string, TokenDefinition> = {
  agentCompanyName: { label: "Company name" },
  agentCompanyNumber: { label: "SC000000" },
  agentRegisteredOffice: { label: "address" },
  agentLarn: { label: "LARN" },
  agentTelephone: { label: "number" },
  agentEmail: { label: "address" },
  agentBankName: { label: "bank name" },
  agentCmpProvider: { label: "provider" },
  agentCmpPolicyNumber: { label: "number" },
  agentPiProvider: { label: "provider" },
  agentPiPolicyNumber: { label: "number" },
  agentIcoNumber: { label: "number" },
  agentComplaintsLink: { label: "link" },
  agentPrivacyLink: { label: "link" },
  agentOfficeHours: { label: "Monday to Friday, 9am to 5pm" },
  agentOutOfHoursNumber: { label: "number" },
}

const PARAGRAPH = (text: string): LandlordTermsBlock => ({ type: "paragraph", text })
const LIST = (...items: string[]): LandlordTermsBlock => ({ type: "list", items })

const TERMS_TEMPLATE: LandlordTermsSection[] = [
  {
    id: "parties",
    heading: "1. Who this agreement is between",
    blocks: [
      PARAGRAPH(
        "1.1 **We, the Agent:** {{agentCompanyName}} Limited, trading as RentSimple, a company registered in Scotland (number {{agentCompanyNumber}}), registered office {{agentRegisteredOffice}}. Letting Agent Registration Number: {{agentLarn}}. Telephone: {{agentTelephone}}. Email: {{agentEmail}}.",
      ),
      PARAGRAPH(
        "1.2 **You, the Landlord:** {{landlordName}}, of {{landlordAddress}}. Email: {{landlordEmail}}. Telephone: {{landlordTelephone}}. Scottish Landlord Registration Number: {{landlordRegistrationNumber}}.",
      ),
      PARAGRAPH(
        "1.3 **The Property:** {{propertyAddresses}}. If we agree to manage more than one property, each is listed in Schedule 1 and these terms apply to each.",
      ),
      PARAGRAPH(
        "1.4 **Service level chosen:** [Tenant find only / Let and rent collection / Full management], as described in clause 3.",
      ),
      PARAGRAPH(
        "1.5 **Start date:** [date]. This agreement starts on that date, or on the date the last party signs if later.",
      ),
      PARAGRAPH("1.6 In this agreement:"),
      LIST(
        "**Code** means the Letting Agent Code of Practice set out in the Letting Agent Code of Practice (Scotland) Regulations 2016.",
        "**Tenancy** means any private residential tenancy of the Property under the Private Housing (Tenancies) (Scotland) Act 2016, and **Tenant** means the tenant under it.",
        "**Tribunal** means the First-tier Tribunal for Scotland (Housing and Property Chamber).",
        "**Client Account** means the bank account described in clause 6.",
        "**Working day** means Monday to Friday, excluding public holidays in Scotland.",
      ),
      PARAGRAPH(
        "1.7 If there is more than one owner, each of you is jointly and severally liable under this agreement, and we may act on the instructions of any one of you unless you tell us otherwise in writing.",
      ),
    ],
  },
  {
    id: "authority",
    heading: "2. Our authority to act",
    blocks: [
      PARAGRAPH(
        "2.1 You appoint us as your agent to let [and manage] the Property and to carry out the services in clause 3 on your behalf. We act in your name and in line with your lawful instructions.",
      ),
      PARAGRAPH(
        "2.2 **Spending limit.** We may arrange repairs, maintenance or replacement goods costing up to £[amount] including VAT for any one item without asking you first. Above that limit we will get your approval before instructing the work.",
      ),
      PARAGRAPH(
        "2.3 **Urgent work.** We may act without your approval, and above the limit in 2.2, where we cannot reach you after reasonable attempts and the work is needed to:",
      ),
      LIST(
        "deal with a risk to anyone's health or safety;",
        "prevent serious damage to the Property or a neighbouring property; or",
        "keep you compliant with a legal duty, such as restoring heating, hot water or a safe electrical or gas supply.",
      ),
      PARAGRAPH("We will tell you what we did and why as soon as we reasonably can."),
      PARAGRAPH(
        "2.4 **What needs your written approval.** We will not, without your written instruction: agree a tenancy; change the rent; serve a notice to leave; start Tribunal or court proceedings; or agree a deduction from a deposit that you have not accepted.",
      ),
      PARAGRAPH(
        "2.5 We will not act on an instruction that would be unlawful or would breach the Code. If you refuse to meet your legal obligations as a landlord, the Code requires us to stop acting for you and to tell the appropriate authority.",
      ),
    ],
  },
  {
    id: "services",
    heading: "3. Our services",
    blocks: [
      PARAGRAPH("3.1 We provide the services marked for the service level you chose in clause 1.4."),
      {
        type: "table",
        headers: ["Service", "Tenant find", "Let and rent collection", "Full management"],
        rows: [
          ["Rental valuation and advice on preparing the Property", "Yes", "Yes", "Yes"],
          ["Advertising and accompanied viewings", "Yes", "Yes", "Yes"],
          ["Applicant referencing and affordability checks", "Yes", "Yes", "Yes"],
          ["Preparing the tenancy agreement and required tenant information", "Yes", "Yes", "Yes"],
          ["Inventory and record of condition at move-in", "Yes", "Yes", "Yes"],
          ["Collecting the first rent and deposit", "Yes", "Yes", "Yes"],
          ["Lodging the deposit with an approved scheme (clause 7)", "[Yes/No]", "Yes", "Yes"],
          ["Collecting rent and paying it to you with a statement", "No", "Yes", "Yes"],
          ["Chasing late rent", "No", "Yes", "Yes"],
          ["Handling repair reports and instructing contractors", "No", "No", "Yes"],
          ["Routine inspections with a written report", "No", "No", "Yes"],
          ["Tracking safety certificate renewal dates and arranging renewals", "No", "No", "Yes"],
          ["Rent reviews and serving rent increase notices on your instruction", "No", "[Yes/No]", "Yes"],
          ["Check-out inspection and deposit return proposal", "No", "No", "Yes"],
        ],
      },
      PARAGRAPH(
        "3.2 Services not listed above, such as attending the Tribunal, managing major works or insurance claims, are extra. We will only carry them out if you ask, at the charges in Schedule 2.",
      ),
      PARAGRAPH("3.3 We will carry out the services with reasonable care and skill, and in line with the Code."),
      PARAGRAPH(
        "3.4 We do not charge tenants or applicants any fee, premium or charge for granting, renewing or continuing a tenancy. Such charges are unlawful in Scotland under the Rent (Scotland) Act 1984.",
      ),
    ],
  },
  {
    id: "standards",
    heading: "4. Service standards",
    blocks: [
      PARAGRAPH(
        "4.1 We aim to meet these target times. They are targets, not guarantees, and we will tell you if we expect to miss one and why.",
      ),
      {
        type: "table",
        headers: ["What", "Target"],
        rows: [
          ["Acknowledge your email, message or call", "[1] working day"],
          ["Full reply to an enquiry", "[5] working days"],
          ["Pay cleared rent to you, less agreed deductions", "[5] working days after it clears"],
          ["Rent statement", "[Monthly, with each payment]"],
          ["Tell you rent is late", "[3] working days after the due date"],
          ["Tell you about a repair report above the limit in clause 2.2", "[1] working day"],
          ["Emergency repair: first action", "[4] hours"],
          ["Urgent repair: first action", "[1] working day"],
          ["Routine repair: contractor instructed", "[5] working days"],
          ["Routine inspections (full management)", "Every [6] months, report within [5] working days"],
          ["Remind you of an expiring safety certificate", "At least [60] days before expiry"],
        ],
      },
    ],
  },
  {
    id: "fees",
    heading: "5. Our fees and charges",
    blocks: [
      PARAGRAPH(
        "5.1 You agree to pay the fees for your service level and any extra charges you have asked for, as set out in Schedule 2. All fees are shown [including VAT at the current rate / with no VAT, as we are not VAT registered].",
      ),
      PARAGRAPH(
        "5.2 **How we collect fees.** We deduct fees and agreed costs from rent we hold for you and show every deduction on your statement. If we are not holding enough, we will invoice you and payment is due within [14] days.",
      ),
      PARAGRAPH(
        "5.3 **Late payment.** If an invoice is unpaid [14] days after its due date, we may charge interest at [X]% a year above the Bank of England base rate on the overdue amount, from the due date until payment.",
      ),
      PARAGRAPH(
        "5.4 **Fee reviews.** We review our fees [once a year]. We will give you at least [2] months' written notice of any change. If you do not accept it, you may end this agreement under clause 16 before the change takes effect, with no termination charge.",
      ),
      PARAGRAPH(
        "5.5 **Third-party costs.** You pay the cost of contractors, certificates, advertising portals and other third-party services we arrange for you. We pass these on [at cost / at cost plus the arrangement fee in Schedule 2] and show them on your statement.",
      ),
      PARAGRAPH(
        "5.6 **Commission and financial interests.** [We do not receive any commission, fee, rebate or other benefit from contractors or third parties in connection with the Property.] / [We receive the following: (list).] We will give you a written statement of any such interest whenever you ask.",
      ),
    ],
  },
  {
    id: "schedule-2",
    heading: "Schedule 2: fees",
    blocks: [
      {
        type: "table",
        headers: ["Fee", "Amount", "When charged"],
        rows: [
          ["Tenant find fee", "[£ / % of first month's rent]", "When the tenancy starts"],
          ["Let and rent collection fee", "[%] of rent collected", "Each time rent is received"],
          ["Full management fee", "[%] of rent collected", "Each time rent is received"],
          ["Set-up fee for a new tenancy", "[£]", "When the tenancy starts"],
          ["Inventory and record of condition", "[£]", "When prepared"],
          ["Arrangement fee on works above £[amount]", "[%] of the invoice", "When the works are paid for"],
          ["Tribunal preparation and attendance", "[£] an hour", "When incurred, on your instruction"],
          ["Additional inspection at your request", "[£]", "When carried out"],
          ["Termination charge (clause 16)", "[£ or none]", "On ending the agreement"],
        ],
      },
      PARAGRAPH(
        "No other fee is payable unless we have told you the amount in writing and you have agreed to it beforehand.",
      ),
    ],
  },
  {
    id: "money",
    heading: "6. How we handle your money",
    blocks: [
      PARAGRAPH(
        "6.1 We hold all money we receive for you or for tenants in a dedicated client account with {{agentBankName}}, which is authorised by the Financial Conduct Authority. The account is separate from our own business money, and the bank has confirmed in writing that it holds client money and cannot be set against anything we owe.",
      ),
      PARAGRAPH(
        "6.2 We keep a record of every payment in and out for you, and reconcile the Client Account at least once a month.",
      ),
      PARAGRAPH(
        "6.3 We pay rent to you by bank transfer to the account you nominate, within the target time in clause 4, after deducting our fees, agreed costs and any float under 6.4. Each payment comes with a statement. We will give you a copy of your account at any time on request.",
      ),
      PARAGRAPH(
        "6.4 **Float.** [We hold a float of £[amount] from your first rent payment to cover small repairs within the limit in clause 2.2. It remains your money and is returned when this agreement ends.] / [We do not hold a float.]",
      ),
      PARAGRAPH(
        "6.5 **Interest.** [Any interest earned on your money in the Client Account is credited to you.] / [The Client Account does not earn interest.]",
      ),
      PARAGRAPH(
        "6.6 We will pay you any money we hold for you without unnecessary delay when you ask for it, unless it is needed for a cost you have already agreed or a legal obligation.",
      ),
      PARAGRAPH(
        "6.7 **Client money protection.** We hold client money protection insurance with {{agentCmpProvider}}, policy number {{agentCmpPolicyNumber}}. Details are available on request.",
      ),
      PARAGRAPH(
        "6.8 **Landlords living outside the UK.** If your usual place of abode is outside the UK, HM Revenue and Customs requires us to deduct basic rate tax from your rent and pay it to them, unless you give us an HMRC approval number allowing us to pay you without deduction. You must tell us at once if you move abroad.",
      ),
    ],
  },
  {
    id: "deposits",
    heading: "7. Tenancy deposits",
    blocks: [
      PARAGRAPH(
        "7.1 Any deposit must be paid to an approved tenancy deposit scheme, and the tenant given the required information, within 30 working days of the start of the tenancy. This is required by the Tenancy Deposit Schemes (Scotland) Regulations 2011.",
      ),
      PARAGRAPH(
        "7.2 **Who lodges the deposit:** [We will lodge it with (scheme name) and give the tenant the required information.] / [You will lodge it and send us proof within the time limit.]",
      ),
      PARAGRAPH(
        "7.3 The legal duty to protect the deposit stays with you as landlord, whoever lodges it. Where we lodge it, we will send you confirmation from the scheme.",
      ),
      PARAGRAPH(
        "7.4 At the end of a tenancy under full management, we will propose how the deposit should be returned, based on the check-out inspection, and will apply to the scheme on your instruction. If the tenant disputes it, the scheme's own dispute process decides the outcome.",
      ),
    ],
  },
  {
    id: "insurance",
    heading: "8. Our insurance",
    blocks: [
      PARAGRAPH(
        "8.1 We hold professional indemnity insurance with {{agentPiProvider}}, policy number {{agentPiPolicyNumber}}. Details, including a summary of the policy, are available on request.",
      ),
    ],
  },
  {
    id: "landlord-obligations",
    heading: "9. What you agree to do",
    blocks: [
      PARAGRAPH(
        "9.1 **Ownership and consent.** You confirm that you own the Property, or are authorised in writing by every owner to sign this agreement, and that you have any consent to let that your mortgage lender, insurer, title deeds or factor require.",
      ),
      PARAGRAPH(
        "9.2 **Identity checks.** The Code requires us to take reasonable steps to confirm your identity and that you are entitled to let the Property. You agree to give us the documents we ask for, and we may not start work until we have them.",
      ),
      PARAGRAPH(
        "9.3 **Landlord registration.** You confirm that you are registered with the local authority as a landlord for the Property under Part 8 of the Antisocial Behaviour etc. (Scotland) Act 2004, and will keep that registration current. If the Property needs a house in multiple occupation licence, you will hold one before it is let.",
      ),
      PARAGRAPH(
        "9.4 **Condition and safety.** You remain legally responsible for the Property meeting the Repairing Standard and the Tolerable Standard under the Housing (Scotland) Act 2006 and 1987, and for all safety requirements that apply to let property. These include gas safety, electrical safety, smoke, heat and carbon monoxide alarms, an energy performance certificate, and a legionella risk assessment.",
      ),
      PARAGRAPH(
        "9.5 Before we advertise the Property you will give us valid copies of the certificates listed in Schedule 3, or instruct us to arrange them at your cost. We will not market or let a property that does not meet these requirements.",
      ),
      PARAGRAPH(
        "9.6 **Insurance.** You will keep buildings insurance suitable for a let property in force, and insurance for any contents you provide, and tell your insurer the Property is let.",
      ),
      PARAGRAPH(
        "9.7 **Information.** You will give us accurate information about the Property, tell us promptly about anything that affects it or the tenancy, and reply to our requests for instructions within a reasonable time.",
      ),
      PARAGRAPH(
        "9.8 **Funds.** You will make sure we hold or are sent enough money to pay for work you have approved and for legal obligations.",
      ),
      PARAGRAPH("9.9 **Tax.** You are responsible for your own tax on rental income. We do not give tax advice."),
      PARAGRAPH(
        "9.10 **Dealing with the tenant.** While we manage the Property you will direct tenant contact through us and will not enter the Property except as the law and the tenancy agreement allow.",
      ),
      PARAGRAPH(
        "9.11 **Your details.** If a tenant asks us in writing for your name and address, the law requires us to provide it.",
      ),
    ],
  },
  {
    id: "repairs",
    heading: "10. Repairs, contractors and inspections",
    note: "This clause applies to full management only.",
    blocks: [
      PARAGRAPH(
        "10.1 We will give tenants a clear way to report repairs, record every report, and tell the tenant what we will do and the likely timescale.",
      ),
      PARAGRAPH(
        "10.2 We will instruct work within the limits in clause 2 and tell you and the tenant about any delay and the reason for it.",
      ),
      PARAGRAPH(
        "10.3 We only use contractors who have shown us that they hold the qualifications, registrations and public liability insurance the work requires, and we keep copies. If you ask us to use your own contractor, you are responsible for checking these and for the quality of their work.",
      ),
      PARAGRAPH("10.4 If work we arranged is not up to standard, we will pursue the contractor to put it right."),
      PARAGRAPH(
        "10.5 We are not responsible for a contractor's work or default, provided we took reasonable care in choosing and instructing them.",
      ),
      PARAGRAPH(
        "10.6 We will give the tenant at least 24 hours' notice of any visit or inspection, unless the situation is urgent, and will not enter if the tenant refuses access. If access is refused, we will tell you and explain the legal options.",
      ),
      PARAGRAPH(
        "10.7 An inspection is a visual check of what can reasonably be seen. It is not a survey and may not reveal hidden defects.",
      ),
      PARAGRAPH(
        "10.8 We keep keys securely, with a record of who has them and when they are issued and returned.",
      ),
    ],
  },
  {
    id: "conflicts",
    heading: "11. Conflicts of interest",
    blocks: [
      PARAGRAPH("11.1 **Declaration at the date of this agreement:**"),
      LIST(
        "[A director of the Agent personally owns residential property let in (area). Those properties may be advertised to the same applicants as yours. We will not favour them over your Property when dealing with enquiries.]",
        "[Repair work may be carried out by (business name), which is owned by / connected to (name). We will tell you before instructing them, show their price, and you may ask for an alternative quote.]",
        "[We have no other actual or potential conflict of interest.]",
      ),
      PARAGRAPH(
        "11.2 We will tell you in writing as soon as we become aware of any new conflict of interest affecting you or the Property.",
      ),
    ],
  },
  {
    id: "code",
    heading: "12. The Code and how we communicate",
    blocks: [
      PARAGRAPH(
        "12.1 We are a registered letting agent and are bound by the Letting Agent Code of Practice. We will give you a copy on request, and it is published at [gov.scot](https://www.gov.scot/publications/letting-agent-code-practice/).",
      ),
      PARAGRAPH(
        "12.2 We will communicate with you through your RentSimple account, by email to the address in clause 1.2, and by telephone. You agree that we may send statements, notices and documents under this agreement electronically. Tell us if you need paper copies.",
      ),
      PARAGRAPH(
        "12.3 You can contact us at {{agentEmail}} or {{agentTelephone}}, {{agentOfficeHours}}. The out-of-hours number for emergencies is {{agentOutOfHoursNumber}}.",
      ),
      PARAGRAPH("12.4 We will reply within the target times in clause 4."),
    ],
  },
  {
    id: "complaints",
    heading: "13. Complaints",
    blocks: [
      PARAGRAPH(
        "13.1 If you are unhappy with our service, please tell us. Our written complaints procedure is at {{agentComplaintsLink}} and we will send a copy on request. We do not charge for handling a complaint.",
      ),
      PARAGRAPH(
        "13.2 **Stage 1.** Send your complaint in writing to [name, role, email]. We will acknowledge it within [3] working days and reply in full within [10] working days.",
      ),
      PARAGRAPH(
        "13.3 **Stage 2.** If you are not satisfied, ask for a review by [name, role]. We will give our final written response within [15] working days of your request.",
      ),
      PARAGRAPH("13.4 If we need longer at either stage, we will tell you why and when you can expect a reply."),
      PARAGRAPH(
        "13.5 The same procedure is open to tenants, and covers complaints about contractors we instructed.",
      ),
      PARAGRAPH(
        "13.6 **The Tribunal.** If you believe we have not complied with the Code, you must first tell us in writing what you think we have failed to do, and give us a reasonable time to put it right. If you remain dissatisfied, you may apply to the First-tier Tribunal for Scotland (Housing and Property Chamber). Tenants and former landlords and tenants have the same right. Details are at [housingandpropertychamber.scot](https://www.housingandpropertychamber.scot/).",
      ),
      PARAGRAPH("13.7 We keep all complaint correspondence for at least five years."),
    ],
  },
  {
    id: "data",
    heading: "14. Your personal information",
    blocks: [
      PARAGRAPH(
        "14.1 We use your personal information to carry out this agreement and to meet our legal duties, in line with UK data protection law. We are registered with the Information Commissioner's Office, number {{agentIcoNumber}}.",
      ),
      PARAGRAPH(
        "14.2 Our privacy notice at {{agentPrivacyLink}} explains what we collect, why, who we share it with and how long we keep it. We share your information with tenants, contractors, deposit schemes, referencing providers, local authorities and HMRC only where needed for the services or required by law.",
      ),
      PARAGRAPH(
        "14.3 Where you give us personal information about a tenant or anyone else, you confirm you are entitled to share it.",
      ),
    ],
  },
  {
    id: "duration",
    heading: "15. How long this agreement lasts and how it can change",
    blocks: [
      PARAGRAPH(
        "15.1 This agreement starts on the start date in clause 1.5 and continues until either of us ends it under clause 16 or you cancel under clause 17. [There is no minimum term.] / [There is a minimum term of (number) months.]",
      ),
      PARAGRAPH(
        "15.2 **Changes.** Any change to this agreement must be agreed by both of us and confirmed in writing, which includes acceptance through your RentSimple account. We will keep a dated record of each version you have agreed.",
      ),
      PARAGRAPH(
        "15.3 If the law or the Code changes in a way that requires us to change these terms, we will tell you in writing what is changing and when. If you do not accept the change, you may end this agreement under clause 16 with no termination charge.",
      ),
    ],
  },
  {
    id: "ending",
    heading: "16. Ending this agreement",
    blocks: [
      PARAGRAPH("16.1 Either of us may end this agreement by giving the other [2] months' written notice."),
      PARAGRAPH(
        "16.2 Either of us may end it immediately by written notice if the other commits a serious breach and, where it can be put right, fails to do so within [14] days of being asked in writing.",
      ),
      PARAGRAPH(
        "16.3 We may end it immediately by written notice if you instruct us to act unlawfully, refuse to meet your legal obligations as a landlord, or are no longer a registered landlord.",
      ),
      PARAGRAPH(
        "16.4 **Charges on ending.** [No termination charge applies.] / [If you end this agreement within the minimum term, the termination charge in Schedule 2 applies.] No charge applies where you end it under clause 5.4, 15.3 or 16.2, or cancel under clause 17. You remain liable for fees and agreed costs up to the end date.",
      ),
      PARAGRAPH(
        "16.5 **Tenant find.** If a tenant we introduced takes a tenancy of the Property within [6] months after this agreement ends, the tenant find fee in Schedule 2 is payable, unless you have already paid it.",
      ),
      PARAGRAPH("16.6 **What we will do when it ends.** We will confirm in writing:"),
      LIST(
        "the date we stop acting for you;",
        "any fees or charges you owe and any money we owe you;",
        "the arrangements for handing over keys, documents, certificates, the tenancy file and deposit scheme details to you or your new agent, including who will contact whom, and when.",
      ),
      PARAGRAPH(
        "16.7 We will pay you all money we hold for you, less anything you owe us, at the final settlement without you having to ask.",
      ),
      PARAGRAPH(
        "16.8 If a tenant is still living in the Property, we will tell them in writing that we no longer act for you and give them your contact details or those of your new agent.",
      ),
    ],
  },
  {
    id: "cancel",
    heading: "17. Your right to cancel",
    blocks: [
      PARAGRAPH(
        "17.1 If you are an individual letting property outside the course of a business, and you sign this agreement away from our premises or at a distance, you have the right to cancel it within 14 calendar days without giving a reason. The period ends 14 days after the day this agreement is signed by both of us. This right comes from the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013.",
      ),
      PARAGRAPH(
        "17.2 To cancel, tell us clearly in writing before the period ends, by email to {{agentEmail}} or post to the address in clause 1.1. You may use the form in Schedule 4 but do not have to.",
      ),
      PARAGRAPH(
        "17.3 We will not start work during the 14 days unless you ask us to in writing. If you ask us to start and then cancel, you must pay for the services we provided up to the time you told us, in proportion to the full price.",
      ),
      PARAGRAPH(
        "17.4 If you cancel, we will refund any other money you have paid within 14 days of your telling us, using the same payment method.",
      ),
    ],
  },
  {
    id: "liability",
    heading: "18. Our liability to you",
    blocks: [
      PARAGRAPH(
        "18.1 Nothing in this agreement limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else the law does not allow us to limit.",
      ),
      PARAGRAPH(
        "18.2 We are responsible for loss you suffer that is a foreseeable result of our breaking this agreement or failing to use reasonable care and skill.",
      ),
      PARAGRAPH("18.3 We are not responsible for:"),
      LIST(
        "a tenant failing to pay rent or to keep to the tenancy agreement, provided we carried out the referencing and rent collection services with reasonable care;",
        "loss caused by your failure to keep to clause 9, or by a delay in giving us instructions or funds;",
        "the condition of the Property or defects that an inspection under clause 10.7 could not reasonably reveal;",
        "events outside our reasonable control.",
      ),
      PARAGRAPH(
        "18.4 We do not guarantee that the Property will be let, the rent that will be achieved, or that a tenant will remain for any period.",
      ),
      PARAGRAPH(
        "18.5 [Subject to 18.1, our total liability to you in any 12 month period is limited to (amount / the limit of our professional indemnity cover).]",
      ),
      PARAGRAPH(
        "18.6 You will repay us for reasonable costs we properly incur in carrying out your lawful instructions under this agreement, except where they result from our own breach or negligence.",
      ),
    ],
  },
  {
    id: "general",
    heading: "19. General",
    blocks: [
      PARAGRAPH(
        "19.1 This agreement, with its schedules, is the whole agreement between us about the Property and replaces anything agreed earlier.",
      ),
      PARAGRAPH("19.2 If any part of it is found to be unenforceable, the rest continues to apply."),
      PARAGRAPH(
        "19.3 We may not transfer this agreement to another agent without your written consent. You may not transfer it to anyone else.",
      ),
      PARAGRAPH(
        "19.4 Written notices may be given by email to the addresses in clause 1, or by post. An email is treated as received on the next working day after it is sent.",
      ),
      PARAGRAPH(
        "19.5 This agreement is governed by Scots law. The Scottish courts have jurisdiction, without affecting your right to apply to the Tribunal.",
      ),
    ],
  },
  {
    id: "signatures",
    heading: "Signatures",
    note: "On RentSimple, your acceptance below is recorded against your account with the date and terms version, in place of a handwritten signature.",
    blocks: [
      PARAGRAPH(
        "By signing, each of us confirms we have read and agree to these terms of business. We both agree that this agreement may be signed and delivered electronically, and that an electronic signature has the same effect as a handwritten one.",
      ),
      PARAGRAPH(
        "[ ] I ask you to start providing the services before the end of the 14 day cancellation period. I understand that if I then cancel, I must pay for the services provided up to that point (clause 17.3).",
      ),
      PARAGRAPH(
        "A signed and dated copy of this agreement will be sent to you by email and kept in your RentSimple account.",
      ),
    ],
  },
  {
    id: "schedule-1",
    heading: "Schedule 1: properties",
    blocks: [],
  },
  {
    id: "schedule-3",
    heading: "Schedule 3: documents needed before marketing",
    blocks: [
      LIST(
        "Proof of identity for each owner, and proof of ownership",
        "Landlord registration number",
        "Lender's and insurer's consent to let, where required",
        "Gas safety certificate, if the Property has gas",
        "Electrical installation condition report and portable appliance test record",
        "Energy performance certificate",
        "Legionella risk assessment",
        "Confirmation that smoke, heat and carbon monoxide alarms meet the current standard",
        "HMO licence, if the Property needs one",
        "Buildings insurance schedule",
      ),
    ],
  },
  {
    id: "schedule-4",
    heading: "Schedule 4: cancellation form",
    blocks: [
      PARAGRAPH("To {{agentCompanyName}} Limited, {{agentRegisteredOffice}}, {{agentEmail}}:"),
      PARAGRAPH(
        "I/We give notice that I/we cancel my/our contract for letting agent services for the property at {{propertyAddresses}}.",
      ),
      PARAGRAPH(
        "Signed on [date of agreement]. Name(s): {{landlordName}}. Address: {{landlordAddress}}. Signature(s) (only if sent on paper): [ ]. Date: [ ].",
      ),
    ],
  },
]

export type LandlordTermsContext = {
  landlord: Pick<AuthUser, "first_name" | "last_name" | "email" | "mobile" | "landlordProfile">
  properties?: Array<Pick<PropertyRecord, "address" | "addressLine1" | "addressLine2" | "city" | "postcode" | "monthlyRent">>
}

function clean(value: string | undefined | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function joinParts(parts: Array<string | undefined | null>) {
  const joined = parts.map(clean).filter(Boolean).join(", ")
  return joined || undefined
}

function formatPropertyAddress(property: NonNullable<LandlordTermsContext["properties"]>[number]) {
  return (
    joinParts([property.addressLine1, property.addressLine2, property.city, property.postcode]) ?? clean(property.address)
  )
}

function formatRent(monthlyRent: number | undefined) {
  if (typeof monthlyRent !== "number" || !Number.isFinite(monthlyRent) || monthlyRent <= 0) {
    return "[£] a month"
  }

  return `${new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(monthlyRent)} a month`
}

export function buildLandlordTermsTokens({ landlord, properties = [] }: LandlordTermsContext) {
  const profile = landlord.landlordProfile
  const propertyAddresses = properties.map(formatPropertyAddress).filter((address): address is string => Boolean(address))

  const landlordTokens: Record<string, TokenDefinition> = {
    landlordName: {
      label: "full name of every owner",
      value: clean(`${landlord.first_name ?? ""} ${landlord.last_name ?? ""}`),
    },
    landlordAddress: {
      label: "address",
      value: joinParts([profile?.addressLine1, profile?.addressLine2, profile?.city, profile?.postcode]),
    },
    landlordEmail: { label: "email", value: clean(landlord.email) },
    landlordTelephone: { label: "telephone", value: clean(landlord.mobile) },
    landlordRegistrationNumber: { label: "number", value: clean(profile?.registrationNumber) },
    propertyAddresses: {
      label: "full address and postcode",
      value: propertyAddresses.length > 0 ? propertyAddresses.join("; ") : undefined,
    },
  }

  return { ...LANDLORD_TERMS_AGENT_DETAILS, ...landlordTokens }
}

function fillTokens(text: string, tokens: Record<string, TokenDefinition>) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const token = tokens[key]

    if (!token) {
      return match
    }

    return token.value ?? `[${token.label}]`
  })
}

function buildScheduleOneRows(context: LandlordTermsContext) {
  const properties = context.properties ?? []

  if (properties.length === 0) {
    return [["[address]", "[level]", "[date]", "[£] a month"]]
  }

  return properties.map((property) => [
    formatPropertyAddress(property) ?? "[address]",
    "[level]",
    "[date]",
    formatRent(property.monthlyRent),
  ])
}

export function buildLandlordTerms(context: LandlordTermsContext): LandlordTermsSection[] {
  const tokens = buildLandlordTermsTokens(context)

  return TERMS_TEMPLATE.map((section) => {
    const blocks: LandlordTermsBlock[] =
      section.id === "schedule-1"
        ? [
            {
              type: "table",
              headers: ["Property address", "Service level", "Start date", "Agreed rent"],
              rows: buildScheduleOneRows(context),
            },
          ]
        : section.blocks

    return {
      ...section,
      blocks: blocks.map((block) => {
        if (block.type === "paragraph") {
          return { ...block, text: fillTokens(block.text, tokens) }
        }

        if (block.type === "list") {
          return { ...block, items: block.items.map((item) => fillTokens(item, tokens)) }
        }

        return {
          ...block,
          headers: block.headers.map((header) => fillTokens(header, tokens)),
          rows: block.rows.map((row) => row.map((cell) => fillTokens(cell, tokens))),
        }
      }),
    }
  })
}

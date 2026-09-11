
-- 1. Storage access for client portal documents ------------------------------
CREATE OR REPLACE FUNCTION private.can_access_pack_record(_record uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pack_records r
    WHERE r.id = _record
      AND (
        private.has_role(auth.uid(), 'super_admin')
        OR private.has_role(auth.uid(), 'admin')
        OR private.has_role(auth.uid(), 'sales_manager')
        OR private.has_role(auth.uid(), 'sales_executive')
        OR r.owner_id = auth.uid()
        OR r.created_by = auth.uid()
        OR r.assigned_to = auth.uid()
        OR lower(r.contact_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
$$;

CREATE POLICY "pack record attachments read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'pack_records'
  AND private.can_access_pack_record(NULLIF((storage.foldername(name))[2], '')::uuid)
);

CREATE POLICY "pack record attachments insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'pack_records'
  AND private.can_access_pack_record(NULLIF((storage.foldername(name))[2], '')::uuid)
);

CREATE POLICY "pack record attachments delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'pack_records'
  AND private.can_access_pack_record(NULLIF((storage.foldername(name))[2], '')::uuid)
);

-- 2. Three custom packs -------------------------------------------------------
INSERT INTO public.pack_configs
  (group_slug, pack_slug, name, tagline, description, gradient, record_label, record_label_plural,
   party_label, value_label, stages, won_stages, lost_stages, kpi_labels, verifications, fields, agents, is_custom)
VALUES
  ('financial-services', 'equipment-leasing', 'Equipment Leasing',
   'Lease enquiries to signed contracts and monthly rentals.',
   'Apply for plant, machinery or fleet leasing. Share your requirement, upload KYC and financials, and track approval to delivery.',
   'linear-gradient(135deg,#0ea5e9,#6366f1)',
   'Lease', 'Leases', 'Lessee', 'Asset value',
   '["Enquiry","Requirement captured","Credit review","Quotation sent","Agreement signed","Delivered","Declined"]',
   '["Delivered"]', '["Declined"]',
   '["Leases","Approval rate","Asset value in pipeline","Average tenure"]',
   '["pan","gst","bank_account","bureau"]',
   '[{"key":"asset_type","label":"Asset type","type":"select","options":["Construction","Manufacturing","IT hardware","Medical","Fleet"]},
     {"key":"tenure_months","label":"Tenure (months)","type":"number"},
     {"key":"down_payment","label":"Down payment","type":"number"},
     {"key":"usage","label":"Intended usage","type":"textarea"}]',
   '[{"key":"credit_summary","label":"Credit summary","description":"Summarise the lessee credit profile.","instruction":"Assess the lessee financials, asset type and tenure, then give a lease recommendation with risks and mitigations."}]',
   true),
  ('commerce', 'franchise-expansion', 'Franchise Expansion',
   'Franchise enquiries to signed territory agreements.',
   'Apply for a franchise territory. Share your investment capacity and location, track site approval and sign-up.',
   'linear-gradient(135deg,#f59e0b,#ef4444)',
   'Franchise application', 'Franchise applications', 'Franchisee', 'Investment',
   '["Enquiry","Screening","Site survey","Business plan","Agreement","Store live","Dropped"]',
   '["Store live"]', '["Dropped"]',
   '["Applications","Sign-up rate","Committed investment","Cities covered"]',
   '["pan","gst","bank_account"]',
   '[{"key":"city_preference","label":"Preferred city","type":"text"},
     {"key":"format","label":"Store format","type":"select","options":["Kiosk","Express","Flagship","Cloud only"]},
     {"key":"investment_capacity","label":"Investment capacity","type":"number"},
     {"key":"experience","label":"Retail experience","type":"textarea"}]',
   '[{"key":"territory_fit","label":"Territory fit","description":"Score the applicant against the territory.","instruction":"Judge the applicant investment capacity, experience and city demand, then score territory fit and list what to verify next."}]',
   true),
  ('professional-services', 'legal-retainers', 'Legal Retainers',
   'Retainer enquiries to signed engagement letters.',
   'Request a legal retainer. Describe the matter, share documents and follow the engagement from proposal to onboarding.',
   'linear-gradient(135deg,#10b981,#0ea5e9)',
   'Retainer', 'Retainers', 'Client', 'Annual fee',
   '["Enquiry","Conflict check","Scoping call","Proposal sent","Engagement signed","Onboarded","Lost"]',
   '["Onboarded"]', '["Lost"]',
   '["Retainers","Win rate","Annual fee booked","Average scope"]',
   '["pan","gst"]',
   '[{"key":"practice_area","label":"Practice area","type":"select","options":["Corporate","Litigation","IP","Employment","Tax","Compliance"]},
     {"key":"engagement_type","label":"Engagement","type":"select","options":["Monthly retainer","Annual retainer","Project"]},
     {"key":"start_date","label":"Preferred start","type":"date"},
     {"key":"matter_summary","label":"Matter summary","type":"textarea"}]',
   '[{"key":"scope_draft","label":"Scope drafter","description":"Draft the retainer scope.","instruction":"From the matter summary and practice area, draft a retainer scope with deliverables, exclusions and a fee range."}]',
   true)
ON CONFLICT (group_slug, pack_slug) DO NOTHING;

-- 3. Seed records for the custom packs ---------------------------------------
INSERT INTO public.pack_records
  (group_slug, pack_slug, title, stage, contact_name, contact_email, contact_phone, city, value, source, priority, fields, owner_id, created_by, won)
VALUES
  ('financial-services','equipment-leasing','Shree Constructions — excavator lease','Credit review','Ramesh Patil','ramesh.patil@shreecon.in','9822014477','Pune',4200000,'Website','high','{"asset_type":"Construction","tenure_months":"48","down_payment":"400000"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false),
  ('financial-services','equipment-leasing','Nova Diagnostics — MRI lease','Agreement signed','Dr. Anita Rao','anita@novadiag.in','9845123390','Bengaluru',18500000,'Referral','urgent','{"asset_type":"Medical","tenure_months":"60","down_payment":"2500000"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false),
  ('financial-services','equipment-leasing','Kirti Logistics — 12 truck fleet','Delivered','Kirti Shah','kirti@kirtilog.com','9930012288','Mumbai',9600000,'Partner','high','{"asset_type":"Fleet","tenure_months":"36","down_payment":"960000"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',true),
  ('financial-services','equipment-leasing','Alpha Prints — offset press','Quotation sent','Suresh Kumar','suresh@alphaprints.in','9701456712','Hyderabad',3100000,'Paid ads','medium','{"asset_type":"Manufacturing","tenure_months":"48","down_payment":"310000"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false),
  ('financial-services','equipment-leasing','Techbridge — 200 laptops','Requirement captured','Nidhi Verma','nidhi@techbridge.io','9871122334','Gurugram',1400000,'Website','low','{"asset_type":"IT hardware","tenure_months":"24","down_payment":"100000"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false),
  ('financial-services','equipment-leasing','Greenfield Farms — harvester','Declined','Balbir Singh','balbir@greenfield.in','9814556677','Ludhiana',2200000,'Branch','medium','{"asset_type":"Manufacturing","tenure_months":"36","down_payment":"150000"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false),

  ('commerce','franchise-expansion','Cafe Aroma — Indiranagar kiosk','Site survey','Vivek Menon','vivek.menon@gmail.com','9886554411','Bengaluru',1800000,'Website','high','{"city_preference":"Bengaluru","format":"Kiosk","investment_capacity":"1800000"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false),
  ('commerce','franchise-expansion','Cafe Aroma — Bandra flagship','Store live','Farah Qureshi','farah@qgroup.in','9820011223','Mumbai',7500000,'Referral','urgent','{"city_preference":"Mumbai","format":"Flagship","investment_capacity":"8000000"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',true),
  ('commerce','franchise-expansion','Cafe Aroma — Jaipur express','Business plan','Rohit Agarwal','rohit.agarwal@outlook.com','9314455667','Jaipur',3200000,'Paid ads','medium','{"city_preference":"Jaipur","format":"Express","investment_capacity":"3500000"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false),
  ('commerce','franchise-expansion','Cafe Aroma — Kochi cloud kitchen','Screening','Deepa Nair','deepa.nair@gmail.com','9846677889','Kochi',1200000,'Website','low','{"city_preference":"Kochi","format":"Cloud only","investment_capacity":"1200000"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false),
  ('commerce','franchise-expansion','Cafe Aroma — Noida express','Agreement','Ankit Chaudhary','ankit@chaudharyretail.in','9911223344','Noida',3000000,'Partner','high','{"city_preference":"Noida","format":"Express","investment_capacity":"3000000"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false),
  ('commerce','franchise-expansion','Cafe Aroma — Surat kiosk','Dropped','Manish Desai','manish.desai@gmail.com','9925566778','Surat',900000,'Website','low','{"city_preference":"Surat","format":"Kiosk","investment_capacity":"900000"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false),

  ('professional-services','legal-retainers','Zeta Fintech — corporate retainer','Proposal sent','Sanjana Kapoor','sanjana@zetafin.in','9873322110','Delhi',1200000,'Referral','high','{"practice_area":"Corporate","engagement_type":"Annual retainer"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false),
  ('professional-services','legal-retainers','Meridian Labs — IP portfolio','Onboarded','Dr. Alok Sen','alok.sen@meridianlabs.com','9836677554','Kolkata',2400000,'Website','urgent','{"practice_area":"IP","engagement_type":"Annual retainer"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',true),
  ('professional-services','legal-retainers','Sunrise Hotels — employment advisory','Scoping call','Priya Iyer','priya@sunrisehotels.in','9840099112','Chennai',600000,'Partner','medium','{"practice_area":"Employment","engagement_type":"Monthly retainer"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false),
  ('professional-services','legal-retainers','Orbit Logistics — tax litigation','Conflict check','Harish Gupta','harish@orbitlog.in','9825566443','Ahmedabad',1500000,'Website','high','{"practice_area":"Tax","engagement_type":"Project"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false),
  ('professional-services','legal-retainers','Nimbus SaaS — compliance retainer','Engagement signed','Karthik Rao','karthik@nimbus.dev','9900112233','Bengaluru',900000,'Paid ads','medium','{"practice_area":"Compliance","engagement_type":"Annual retainer"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false),
  ('professional-services','legal-retainers','Vayu Airlines — contracts review','Lost','Neha Bhatt','neha.bhatt@vayuair.in','9820044556','Mumbai',1800000,'Referral','low','{"practice_area":"Corporate","engagement_type":"Project"}','fde5c306-341f-47ca-8174-c8ff0b0d847f','fde5c306-341f-47ca-8174-c8ff0b0d847f',false);

-- 4. Documents and fees for the seeded custom-pack records --------------------
INSERT INTO public.pack_documents (record_id, name, doc_type, status, uploaded_by)
SELECT r.id, d.name, d.doc_type, d.status, 'fde5c306-341f-47ca-8174-c8ff0b0d847f'
FROM public.pack_records r
CROSS JOIN LATERAL (VALUES
  ('PAN card','pan','verified'),
  ('GST certificate','gst','uploaded'),
  ('Bank statement (6 months)','bank_stmt','pending')
) AS d(name, doc_type, status)
WHERE r.pack_slug IN ('equipment-leasing','franchise-expansion','legal-retainers');

INSERT INTO public.pack_payments (record_id, kind, label, amount, status, due_date, created_by)
SELECT r.id, 'invoice', 'Processing fee', GREATEST(round(coalesce(r.value,0) * 0.01), 5000),
       CASE WHEN r.won THEN 'paid' ELSE 'due' END, current_date + 15,
       'fde5c306-341f-47ca-8174-c8ff0b0d847f'
FROM public.pack_records r
WHERE r.pack_slug IN ('equipment-leasing','franchise-expansion','legal-retainers');

'use strict';

const { Router } = require('express');
const { authenticate }     = require('../middleware/auth');
const { odoo, KYC_STATUS_MAP } = require('../services/odoo');
const { odoo: odooConfig }     = require('../config');

const router = Router();

// Bearer token check applied to every route in this file.
router.use(authenticate);

const CATEGORY_MAP = {
  'individual': 'ind',
  'ind':        'ind',
  'corporate':  'corp',
  'corp':       'corp',
};

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateCustomerRequest:
 *       type: object
 *       required:
 *         - FirstName
 *         - LastName
 *         - EmailAddress
 *         - PhoneNumber
 *       properties:
 *         FirstName:
 *           type: string
 *           description: Customer's first name
 *           example: John
 *           minLength: 1
 *         LastName:
 *           type: string
 *           description: Customer's last name
 *           example: Doe
 *           minLength: 1
 *         EmailAddress:
 *           type: string
 *           format: email
 *           description: Customer's email address (unique identifier)
 *           example: john.doe@example.com
 *         PhoneNumber:
 *           type: string
 *           description: Customer's phone number
 *           example: "+2348012345678"
 *           minLength: 1
 *         CustomerType:
 *           type: string
 *           enum: [individual, ind, corporate, corp]
 *           description: Type of customer. Mapped internally to 'ind' or 'corp' in Odoo
 *           example: individual
 *           default: individual
 *         Address:
 *           type: string
 *           description: Customer's street address
 *           example: "123 Main Street, Lagos"
 *         KycStatus:
 *           type: string
 *           enum: [none, pending, in_progress, bvn, nin, bvn_nin, completed, failed]
 *           description: KYC verification status
 *           example: pending
 *           default: pending
 *         LeadStatus:
 *           type: string
 *           description: Initial CRM pipeline stage for the lead opportunity
 *           example: "New Lead"
 *           default: "New Lead"
 *     UpdateDetailsRequest:
 *       type: object
 *       required:
 *         - CustomerEmail
 *       properties:
 *         CustomerEmail:
 *           type: string
 *           format: email
 *           description: Email address of the customer to update
 *           example: john.doe@example.com
 *         FirstName:
 *           type: string
 *           description: New first name (must be provided together with LastName)
 *           example: John
 *         LastName:
 *           type: string
 *           description: New last name (must be provided together with FirstName)
 *           example: Smith
 *         PhoneNumber:
 *           type: string
 *           description: New phone number
 *           example: "+2348012345678"
 *         Address:
 *           type: string
 *           description: New street address
 *           example: "456 New Street, Abuja"
 *         CustomerType:
 *           type: string
 *           enum: [individual, ind, corporate, corp]
 *           description: New customer type. Mapped internally to 'ind' or 'corp'
 *           example: corporate
 *     UpdateKycRequest:
 *       type: object
 *       required:
 *         - CustomerEmail
 *         - KycStatus
 *       properties:
 *         CustomerEmail:
 *           type: string
 *           format: email
 *           description: Email address of the customer
 *           example: john.doe@example.com
 *         KycStatus:
 *           type: string
 *           enum: [none, pending, in_progress, bvn, nin, bvn_nin, completed, failed]
 *           description: New KYC verification status
 *           example: completed
 *     UpdateLeadStatusRequest:
 *       type: object
 *       required:
 *         - CustomerEmail
 *         - LeadStatus
 *       properties:
 *         CustomerEmail:
 *           type: string
 *           format: email
 *           description: Email address of the customer
 *           example: john.doe@example.com
 *         LeadStatus:
 *           type: string
 *           description: Target CRM pipeline stage name (must exist in Odoo CRM)
 *           example: "Qualified"
 *     CustomerCreatedResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indicates if the operation was successful
 *           example: true
 *         partner_id:
 *           type: integer
 *           description: Odoo partner ID of the created customer
 *           example: 42
 *         lead_id:
 *           type: integer
 *           description: Odoo CRM lead ID of the created opportunity
 *           example: 15
 *     CustomerUpdatedResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indicates if the operation was successful
 *           example: true
 *         partner_id:
 *           type: integer
 *           description: Odoo partner ID of the updated customer
 *           example: 42
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indicates if the operation was successful
 *           example: true
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Always false for error responses
 *           example: false
 *         error:
 *           type: string
 *           description: Human-readable error message
 *           example: "An unexpected error occurred. Check the server logs."
 */

/**
 * @swagger
 * /api/customer/create:
 *   post:
 *     tags:
 *       - Customer
 *     summary: Create a new customer
 *     description: >
 *       Strictly creates a new customer and associated CRM lead/opportunity.
 *       The customer is created in Odoo as both a partner (res.partner) and a CRM lead (crm.lead).
 *       Returns 409 if a customer with the same email already exists.
 *       The CRM lead is created as type 'opportunity' so it appears on the CRM Kanban pipeline board.
 *     operationId: createCustomer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCustomerRequest'
 *           examples:
 *             individual:
 *               summary: Individual customer
 *               value:
 *                 FirstName: "John"
 *                 LastName: "Doe"
 *                 EmailAddress: "john.doe@example.com"
 *                 PhoneNumber: "+2348012345678"
 *                 CustomerType: "individual"
 *                 Address: "123 Main Street, Lagos"
 *                 KycStatus: "pending"
 *                 LeadStatus: "New Lead"
 *             corporate:
 *               summary: Corporate customer
 *               value:
 *                 FirstName: "Jane"
 *                 LastName: "Smith"
 *                 EmailAddress: "jane.smith@company.com"
 *                 PhoneNumber: "+2348012345679"
 *                 CustomerType: "corporate"
 *                 Address: "456 Business Avenue, Abuja"
 *                 KycStatus: "in_progress"
 *                 LeadStatus: "New Lead"
 *     responses:
 *       '201':
 *         description: Customer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomerCreatedResponse'
 *             example:
 *               success: true
 *               partner_id: 42
 *               lead_id: 15
 *       '400':
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Missing required fields: FirstName, EmailAddress."
 *       '409':
 *         description: Customer with this email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "A customer with this email address already exists."
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "An unexpected error occurred. Check the server logs."
 */
router.post('/create', async (req, res) => {
  const { FirstName, LastName, EmailAddress, PhoneNumber, CustomerType, Address, KycStatus, LeadStatus } = req.body;

  const required = { FirstName, LastName, EmailAddress, PhoneNumber };
  const missing  = Object.keys(required).filter(k => !String(required[k] ?? '').trim());

  if (missing.length) {
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.join(', ')}.`,
    });
  }

  const email = EmailAddress.trim().toLowerCase();

  try {
    const existing = await odoo.search('res.partner', [['email', '=ilike', email]]);
    if (existing.length) {
      return res.status(409).json({
        success: false,
        error: 'A customer with this email address already exists.',
      });
    }

    const kycRaw   = (KycStatus || 'pending').trim().toLowerCase();
    const kycValue = KYC_STATUS_MAP[kycRaw] || 'pending';
    const custTypeRaw   = (CustomerType || 'individual').trim().toLowerCase();
    const custTypeValue = CATEGORY_MAP[custTypeRaw] || 'ind';
    const partnerId = await odoo.create('res.partner', {
      name:                              `${FirstName.trim()} ${LastName.trim()}`,
      email,
      phone:                             PhoneNumber.trim(),
      street:                            Address?.trim()      || false,
      [odooConfig.fields.kycStatus]:     kycValue,
      [odooConfig.fields.customerType]:  custTypeValue,
      customer_rank:                     1,
    });

    const stageLabel = (LeadStatus || 'New').trim();
    const stages     = await odoo.search('crm.stage', [['name', 'ilike', stageLabel]]);
    const stageId    = stages[0]?.id || false;

    // Created as 'opportunity' so it appears on the CRM Kanban pipeline board.
    const leadId = await odoo.create('crm.lead', {
      name:       `${FirstName.trim()} ${LastName.trim()}`,
      partner_id: partnerId,
      email_from: email,
      phone:      PhoneNumber.trim(),
      stage_id:   stageId,
      type:       'opportunity',
    });

    console.log(`[CustomerSync] Contact created: id=${partnerId} | Lead created: id=${leadId}`);

    return res.status(201).json({ success: true, partner_id: partnerId, lead_id: leadId });

  } catch (err) {
    console.error('[CustomerSync] Failed to create customer:', err.message);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Check the server logs.',
    });
  }
});

/**
 * @swagger
 * /api/customer/update-details:
 *   post:
 *     tags:
 *       - Customer
 *     summary: Update customer details
 *     description: >
 *       Strictly updates an existing customer's information in Odoo.
 *       Only fields present in the request body are written — everything else is untouched.
 *       When updating the customer name, both FirstName and LastName are required.
 *       Returns 404 if no customer is found with the given email address.
 *     operationId: updateCustomerDetails
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateDetailsRequest'
 *           examples:
 *             updateName:
 *               summary: Update customer name
 *               value:
 *                 CustomerEmail: "john.doe@example.com"
 *                 FirstName: "John"
 *                 LastName: "Smith"
 *             updatePhone:
 *               summary: Update phone number
 *               value:
 *                 CustomerEmail: "john.doe@example.com"
 *                 PhoneNumber: "+2348012345678"
 *             updateMultiple:
 *               summary: Update multiple fields
 *               value:
 *                 CustomerEmail: "john.doe@example.com"
 *                 PhoneNumber: "+2348012345678"
 *                 Address: "456 New Street, Abuja"
 *                 CustomerType: "corporate"
 *     responses:
 *       '200':
 *         description: Customer updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomerUpdatedResponse'
 *             example:
 *               success: true
 *               partner_id: 42
 *       '400':
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingEmail:
 *                 summary: Missing email
 *                 value:
 *                   success: false
 *                   error: "CustomerEmail is required."
 *               partialName:
 *                 summary: Missing first or last name
 *                 value:
 *                   success: false
 *                   error: "Both FirstName and LastName are required when updating the customer name."
 *               noFields:
 *                 summary: No updatable fields provided
 *                 value:
 *                   success: false
 *                   error: "No updatable fields were provided. Accepted: FirstName + LastName, PhoneNumber, Address, CustomerType."
 *       '404':
 *         description: Customer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "No customer found with that email address."
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "An unexpected error occurred. Check the server logs."
 */
router.post('/update-details', async (req, res) => {
  const { CustomerEmail, FirstName, LastName, PhoneNumber, Address, CustomerType } = req.body;

  const email = (CustomerEmail || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ success: false, error: 'CustomerEmail is required.' });
  }

  try {
    const partners = await odoo.search('res.partner', [['email', '=ilike', email]]);
    if (!partners.length) {
      return res.status(404).json({
        success: false,
        error: 'No customer found with that email address.',
      });
    }

    const updates    = {};
    const hasFirst   = FirstName !== undefined;
    const hasLast    = LastName  !== undefined;

    if (hasFirst || hasLast) {
      const first = (FirstName || '').trim();
      const last  = (LastName  || '').trim();
      if (!first || !last) {
        return res.status(400).json({
          success: false,
          error: 'Both FirstName and LastName are required when updating the customer name.',
        });
      }
      updates.name = `${first} ${last}`;
    }
    const custTypeRaw   = (CustomerType || 'individual').trim().toLowerCase();

    if (PhoneNumber?.trim())  updates.phone                             = PhoneNumber.trim();
    if (Address?.trim())      updates.street                            = Address.trim();
    if (CustomerType?.trim()) updates[odooConfig.fields.customerType]   = CATEGORY_MAP[custTypeRaw] || 'ind';

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        error: 'No updatable fields were provided. Accepted: FirstName + LastName, PhoneNumber, Address, CustomerType.',
      });
    }


    const partnerId = partners[0].id;
    await odoo.write('res.partner', [partnerId], updates);

    console.log(`[CustomerSync] Contact updated: id=${partnerId} | fields: ${Object.keys(updates).join(', ')}`);

    return res.json({ success: true, partner_id: partnerId });

  } catch (err) {
    console.error('[CustomerSync] Failed to update customer details:', err.message);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Check the server logs.',
    });
  }
});

/**
 * @swagger
 * /api/customer/update-kyc:
 *   post:
 *     tags:
 *       - Customer
 *     summary: Update KYC verification status
 *     description: >
 *       Updates the KYC (Know Your Customer) verification status for an existing customer in Odoo.
 *       The status is mapped internally using the KYC_STATUS_MAP before being written to Odoo.
 *       Returns 404 if no customer is found with the given email address.
 *     operationId: updateKycStatus
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateKycRequest'
 *           examples:
 *             pending:
 *               summary: Set to pending
 *               value:
 *                 CustomerEmail: "john.doe@example.com"
 *                 KycStatus: "pending"
 *             completed:
 *               summary: Set to completed
 *               value:
 *                 CustomerEmail: "john.doe@example.com"
 *                 KycStatus: "complete"
 *             inProgress:
 *               summary: Set to in progress
 *               value:
 *                 CustomerEmail: "john.doe@example.com"
 *                 KycStatus: "in_progress"
 *             failed:
 *               summary: Set to failed
 *               value:
 *                 CustomerEmail: "john.doe@example.com"
 *                 KycStatus: "failed"
 *     responses:
 *       '200':
 *         description: KYC status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *       '400':
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingFields:
 *                 summary: Missing required fields
 *                 value:
 *                   success: false
 *                   error: "CustomerEmail and KycStatus are required."
 *               invalidStatus:
 *                 summary: Invalid KYC status
 *                 value:
 *                   success: false
 *                   error: "Invalid KycStatus. Accepted values: Pending, In Review, Completed, Rejected."
 *       '404':
 *         description: Customer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "No customer found with that email address."
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "An unexpected error occurred. Check the server logs."
 */
router.post('/update-kyc', async (req, res) => {
  const { CustomerEmail, KycStatus } = req.body;

  const email  = (CustomerEmail || '').trim().toLowerCase();
  const rawKyc = (KycStatus     || '').trim().toLowerCase();

  if (!email || !rawKyc) {
    return res.status(400).json({
      success: false,
      error: 'CustomerEmail and KycStatus are required.',
    });
  }

  const kycValue = KYC_STATUS_MAP[rawKyc];
  if (!kycValue) {
    return res.status(400).json({
      success: false,
      error: 'Invalid KycStatus. Accepted values: Pending, In Review, Completed, Rejected.',
    });
  }

  try {
    const partners = await odoo.search('res.partner', [['email', '=ilike', email]]);
    if (!partners.length) {
      return res.status(404).json({
        success: false,
        error: 'No customer found with that email address.',
      });
    }

    await odoo.write('res.partner', [partners[0].id], {
      [odooConfig.fields.kycStatus]: kycValue,
    });

    console.log(`[CustomerSync] KYC updated: partner id=${partners[0].id} → ${kycValue}`);

    return res.json({ success: true });

  } catch (err) {
    console.error('[CustomerSync] Failed to update KYC status:', err.message);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Check the server logs.',
    });
  }
});

/**
 * @swagger
 * /api/customer/update-lead-status:
 *   post:
 *     tags:
 *       - Customer
 *     summary: Update CRM lead pipeline status
 *     description: >
 *       Moves a customer's associated CRM lead (opportunity) to a different pipeline stage.
 *       Searches for the lead by the customer's partner_id and looks up the stage by name in crm.stage.
 *       Returns 404 if no customer, lead, or stage is found.
 *     operationId: updateLeadStatus
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateLeadStatusRequest'
 *           examples:
 *             qualified:
 *               summary: Move to Qualified
 *               value:
 *                 CustomerEmail: "john.doe@example.com"
 *                 LeadStatus: "Qualified"
 *             won:
 *               summary: Move to Won
 *               value:
 *                 CustomerEmail: "john.doe@example.com"
 *                 LeadStatus: "Won"
 *             lost:
 *               summary: Move to Lost
 *               value:
 *                 CustomerEmail: "john.doe@example.com"
 *                 LeadStatus: "Lost"
 *     responses:
 *       '200':
 *         description: Lead status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *       '400':
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "CustomerEmail and LeadStatus are required."
 *       '404':
 *         description: Resource not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               noCustomer:
 *                 summary: Customer not found
 *                 value:
 *                   success: false
 *                   error: "No customer found with that email address."
 *               noLead:
 *                 summary: No CRM lead found
 *                 value:
 *                   success: false
 *                   error: "No CRM lead found for this customer."
 *               noStage:
 *                 summary: Stage not found
 *                 value:
 *                   success: false
 *                   error: "Stage 'InvalidStage' was not found in the CRM pipeline."
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "An unexpected error occurred. Check the server logs."
 */
router.post('/update-lead-status', async (req, res) => {
  const { CustomerEmail, LeadStatus } = req.body;

  const email      = (CustomerEmail || '').trim().toLowerCase();
  const leadStatus = (LeadStatus    || '').trim();

  if (!email || !leadStatus) {
    return res.status(400).json({
      success: false,
      error: 'CustomerEmail and LeadStatus are required.',
    });
  }

  try {
    const partners = await odoo.search('res.partner', [['email', '=ilike', email]]);
    if (!partners.length) {
      return res.status(404).json({
        success: false,
        error: 'No customer found with that email address.',
      });
    }

    const leads = await odoo.search(
      'crm.lead',
      [['partner_id', '=', partners[0].id]],
      { fields: ['id'], limit: 1, order: 'id desc' },
    );
    if (!leads.length) {
      return res.status(404).json({
        success: false,
        error: 'No CRM lead found for this customer.',
      });
    }

    const stages = await odoo.search('crm.stage', [['name', 'ilike', leadStatus]], { fields: ['id', 'name'] });
    if (!stages.length) {
      return res.status(404).json({
        success: false,
        error: `Stage '${leadStatus}' was not found in the CRM pipeline.`,
      });
    }

    await odoo.write('crm.lead', [leads[0].id], { stage_id: stages[0].id });

    console.log(`[CustomerSync] Lead id=${leads[0].id} moved to stage "${stages[0].name}"`);

    return res.json({ success: true });

  } catch (err) {
    console.error('[CustomerSync] Failed to update lead status:', err.message);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Check the server logs.',
    });
  }
});

module.exports = router;
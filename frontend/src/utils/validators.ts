import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(9, 'Use more than 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[^a-zA-Z0-9\s]/, 'Must contain a special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const productVariantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Variant name is required'),
  additional_price: z.coerce.number().min(0, 'Additional price must be 0 or positive'),
});

export const productSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  type: z.enum(['service', 'software', 'addon']),
  sales_price: z.coerce.number().min(0, 'Sales price must be positive'),
  cost_price: z.coerce.number().min(0, 'Cost price must be positive'),
  status: z.enum(['active', 'archived']).default('active'),
  description: z.string().optional(),
  variants: z.array(productVariantSchema).default([]),
});

export type ProductFormData = z.infer<typeof productSchema>;

export const planSchema = z.object({
  name: z.string().min(2, 'Plan name is required'),
  product_id: z.string().min(1, 'Please select a product'),
  billing_cycle: z.enum(['monthly', 'yearly', 'weekly', 'daily']),
  price: z.coerce.number().min(0, 'Price must be positive'),
  available_from: z.string().optional(),
  available_to: z.string().optional(),
  min_qty: z.coerce.number().int().min(1, 'Minimum quantity must be at least 1'),
  auto_close: z.boolean().default(false),
  allow_early_close: z.boolean().default(false),
  allow_pause: z.boolean().default(true),
  allow_renewal: z.boolean().default(true),
  status: z.enum(['active', 'archived']).default('active'),
  description: z.string().optional(),
});

export type PlanFormData = z.infer<typeof planSchema>;

export const subscriptionLineSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().min(1, 'Product is required'),
  product_name: z.string().optional(),
  variant_id: z.string().optional(),
  variant_name: z.string().optional(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  unit_price: z.coerce.number().min(0, 'Unit price must be positive'),
  subtotal: z.coerce.number().optional(),
});

export const subscriptionSchema = z
  .object({
    customer_id: z.string().min(1, 'Customer is required'),
    customer_name: z.string().optional(),
    plan_id: z.string().min(1, 'Plan is required'),
    plan_name: z.string().optional(),
    start_date: z.string().min(1, 'Start date is required'),
    expiry_date: z.string().min(1, 'Expiry date is required'),
    billing_cycle: z.enum(['monthly', 'yearly', 'weekly', 'daily']).default('monthly'),
    payment_terms: z.string().default('Net 30'),
    quotation_template: z.string().optional(),
    notes: z.string().optional(),
    lines: z.array(subscriptionLineSchema).min(1, 'At least one line item is required'),
  })
  .refine((d) => d.expiry_date > d.start_date, {
    message: 'Expiry must be after the start date',
    path: ['expiry_date'],
  });

export type SubscriptionFormData = z.infer<typeof subscriptionSchema>;

export const paymentRecordSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  payment_method: z.enum(['credit_card', 'bank_transfer', 'cash', 'upi']),
  payment_date: z.string().min(1, 'Payment date is required'),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
});

export type PaymentRecordFormData = z.infer<typeof paymentRecordSchema>;

export const discountSchema = z
  .object({
    name: z.string().min(2, 'Discount name is required'),
    code: z.string().min(2, 'Promo code is required').toUpperCase(),
    type: z.enum(['percentage', 'fixed']),
    value: z.coerce.number().min(0.01, 'Value must be greater than 0'),
    min_quantity: z.coerce.number().int().min(1).default(1),
    applies_to: z.enum(['subscription', 'product']).default('subscription'),
    product_id: z.string().optional(),
    min_purchase: z.coerce.number().min(0, 'Min purchase must be positive'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().min(1, 'End date is required'),
    max_uses: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.coerce.number().int().min(1).optional(),
    ),
    status: z.enum(['active', 'expired', 'disabled']).default('active'),
  })
  .refine((d) => d.type !== 'percentage' || d.value <= 100, {
    message: 'Percentage cannot exceed 100',
    path: ['value'],
  })
  .refine((d) => d.end_date > d.start_date, {
    message: 'End date must be after start date',
    path: ['end_date'],
  })
  .refine((d) => d.applies_to !== 'product' || !!d.product_id, {
    message: 'Select an eligible product',
    path: ['product_id'],
  });

export type DiscountFormData = z.infer<typeof discountSchema>;

export const userCreateSchema = z.object({
  name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  role: z.enum(['admin', 'staff', 'customer']),
  password: z
    .string()
    .min(9, 'Use more than 8 characters')
    .regex(/[A-Z]/, 'Include uppercase')
    .regex(/[a-z]/, 'Include lowercase')
    .regex(/[^a-zA-Z0-9\s]/, 'Include a special character'),
  status: z.enum(['active', 'inactive']).default('active'),
});

export type UserCreateFormData = z.infer<typeof userCreateSchema>;

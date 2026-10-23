import { render, screen } from '@testing-library/react';
import { FormField } from './form';
import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

describe('FormField', () => {
  it('links label, hint and error to the control for screen readers', () => {
    render(<FormField label="Email" hint="We never share it" error="Enter a valid email" required><Input /></FormField>);
    const input = screen.getByLabelText(/email/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    const described = input.getAttribute('aria-describedby')!.split(' ');
    expect(described).toHaveLength(2);
    expect(document.getElementById(described[1]!)).toHaveTextContent('Enter a valid email');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');
  });

  it('has no aria-invalid when valid', () => {
    render(<FormField label="Name"><Input /></FormField>);
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
  });

  it('labels a Radix Select trigger and a control wrapped in another element', () => {
    render(
      <>
        <FormField label="Category" hint="Pick one">
          <Select value="a"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">A</SelectItem></SelectContent></Select>
        </FormField>
        <FormField label="Tags" error="Too many">
          <div><Input /><ul /></div>
        </FormField>
      </>,
    );
    expect(screen.getByRole('combobox', { name: /category/i })).toHaveAttribute('aria-describedby');
    const tags = screen.getByLabelText('Tags');
    expect(tags.tagName).toBe('INPUT');
    expect(tags).toHaveAttribute('aria-invalid', 'true');
  });
});

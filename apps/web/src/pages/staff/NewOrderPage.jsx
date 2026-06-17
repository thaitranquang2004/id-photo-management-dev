import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Search, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, Button, Col, Form, InputGroup, ListGroup, Row, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { listCardTypes } from '../../api/admin';
import { createCustomer, searchCustomersByPhone } from '../../api/customers';
import { createOrder } from '../../api/orders';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import { formatCurrency } from '../../utils/format';

const steps = ['Khách hàng', 'Thông tin đơn', 'Xác nhận'];

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({ full_name: '', phone: '', email: '', notes: '' });
  const [orderForm, setOrderForm] = useState({
    card_type_id: '',
    quantity: 4,
    pickup_date: '',
    notes: ''
  });

  const cardTypesQuery = useQuery({
    queryKey: ['card-types'],
    queryFn: listCardTypes
  });

  const searchMutation = useMutation({
    mutationFn: searchCustomersByPhone,
    onSuccess: (result) => {
      setCustomers(result);
      if (result.length === 1) setSelectedCustomer(result[0]);
    }
  });

  const createCustomerMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: ({ customer }) => {
      setSelectedCustomer(customer);
      setCustomers([customer]);
      setStep(1);
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: ({ order }) => navigate(`/staff/orders/${order.id}`)
  });

  const cardTypes = cardTypesQuery.data?.card_types || [];
  const selectedCardType = cardTypes.find((cardType) => cardType.id === orderForm.card_type_id);
  const estimatedTotal = useMemo(() => {
    if (!selectedCardType) return 0;
    return Number(selectedCardType.current_price_per_copy || 0) * Number(orderForm.quantity || 0)
      + Number(selectedCardType.current_processing_fee || 0);
  }, [orderForm.quantity, selectedCardType]);

  function handleSearch(event) {
    event.preventDefault();
    const value = phone.trim();
    if (!value) return;
    setCustomerForm((current) => ({ ...current, phone: value }));
    searchMutation.mutate(value);
  }

  function submitCustomer(event) {
    event.preventDefault();
    createCustomerMutation.mutate(customerForm);
  }

  function submitOrder() {
    if (!selectedCustomer || !selectedCardType) return;
    createOrderMutation.mutate({
      customer_id: selectedCustomer.id,
      card_type_id: selectedCardType.id,
      quantity: Number(orderForm.quantity),
      pickup_date: orderForm.pickup_date || undefined,
      notes: orderForm.notes || undefined
    });
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Tạo đơn mới</h1>
          <p>Wizard 3 bước: tìm khách, chọn loại thẻ, xác nhận giá tạm tính.</p>
        </div>
      </div>

      <div className="wizard-steps">
        {steps.map((label, index) => (
          <button
            type="button"
            key={label}
            className={`wizard-step ${index === step ? 'active' : ''} ${index < step ? 'done' : ''}`}
            onClick={() => index <= step && setStep(index)}
          >
            <span>{index < step ? <Check size={15} /> : index + 1}</span>
            {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <Row className="g-3">
          <Col lg={6}>
            <section className="app-panel">
              <h2>Tìm khách bằng SĐT</h2>
              <Form onSubmit={handleSearch}>
                <InputGroup className="mb-3">
                  <Form.Control
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Nhập số điện thoại"
                  />
                  <Button type="submit" disabled={!phone.trim() || searchMutation.isPending}>
                    <Search size={17} aria-hidden="true" />
                    Tìm
                  </Button>
                </InputGroup>
              </Form>
              {searchMutation.isPending ? <LoadingState label="Đang tìm khách..." /> : null}
              {searchMutation.error ? <ErrorState error={searchMutation.error} /> : null}
              {customers.length > 0 ? (
                <ListGroup className="selection-list">
                  {customers.map((customer) => (
                    <ListGroup.Item
                      key={customer.id}
                      action
                      active={selectedCustomer?.id === customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <div className="fw-semibold">{customer.full_name}</div>
                      <div className="small">{customer.phone}</div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : !searchMutation.isIdle && !searchMutation.isPending ? (
                <EmptyState title="Chưa có khách" description="Tạo khách mới ở form bên cạnh nếu số điện thoại chưa tồn tại." />
              ) : null}
              <div className="mt-3 text-end">
                <Button onClick={() => setStep(1)} disabled={!selectedCustomer}>
                  Tiếp tục
                </Button>
              </div>
            </section>
          </Col>
          <Col lg={6}>
            <section className="app-panel">
              <h2>Thêm khách mới</h2>
              <Form onSubmit={submitCustomer}>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Họ tên</Form.Label>
                      <Form.Control
                        value={customerForm.full_name}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, full_name: event.target.value }))}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Số điện thoại</Form.Label>
                      <Form.Control
                        value={customerForm.phone}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        value={customerForm.email}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Ghi chú</Form.Label>
                      <Form.Control
                        value={customerForm.notes}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, notes: event.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                {createCustomerMutation.error ? <Alert variant="danger" className="mt-3">{createCustomerMutation.error.message}</Alert> : null}
                <Button
                  type="submit"
                  className="mt-3 button-nowrap"
                  disabled={createCustomerMutation.isPending || !customerForm.full_name || !customerForm.phone}
                >
                  <UserPlus size={17} aria-hidden="true" />
                  Thêm khách
                </Button>
              </Form>
            </section>
          </Col>
        </Row>
      ) : null}

      {step === 1 ? (
        <section className="app-panel">
          <h2>Chọn loại thẻ và thông tin nhận ảnh</h2>
          {cardTypesQuery.isLoading ? <LoadingState /> : null}
          {cardTypesQuery.error ? <ErrorState error={cardTypesQuery.error} /> : null}
          {!cardTypesQuery.isLoading && !cardTypesQuery.error ? (
            <>
              <div className="table-responsive">
                <Table hover className="align-middle data-table">
                  <thead>
                    <tr>
                      <th>Chọn</th>
                      <th>Loại thẻ</th>
                      <th>Kích thước</th>
                      <th>Nền</th>
                      <th>Giá hiện hành</th>
                      <th>Yêu cầu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardTypes.map((cardType) => (
                      <tr key={cardType.id} className={orderForm.card_type_id === cardType.id ? 'selected-row' : ''}>
                        <td>
                          <Form.Check
                            type="radio"
                            name="card-type"
                            checked={orderForm.card_type_id === cardType.id}
                            onChange={() => setOrderForm((current) => ({ ...current, card_type_id: cardType.id }))}
                            aria-label={`Chọn ${cardType.name}`}
                          />
                        </td>
                        <td>
                          <div className="fw-semibold">{cardType.name}</div>
                          <div className="text-muted small">{cardType.short_code}</div>
                        </td>
                        <td>{cardType.width_mm} x {cardType.height_mm} mm</td>
                        <td>
                          <span className="color-swatch" style={{ backgroundColor: cardType.background_color }} />
                          {cardType.background_color}
                        </td>
                        <td>{formatCurrency(Number(cardType.current_price_per_copy || 0) + Number(cardType.current_processing_fee || 0))}</td>
                        <td className="requirements-cell">{JSON.stringify(cardType.requirements || {})}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              {cardTypes.length === 0 ? <EmptyState title="Chưa có loại thẻ" description="Admin cần tạo loại thẻ trước khi staff tạo đơn." /> : null}
              <Row className="g-3 mt-1">
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Số lượng</Form.Label>
                    <Form.Control
                      type="number"
                      min="1"
                      value={orderForm.quantity}
                      onChange={(event) => setOrderForm((current) => ({ ...current, quantity: event.target.value }))}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Ngày hẹn lấy</Form.Label>
                    <Form.Control
                      type="date"
                      value={orderForm.pickup_date}
                      onChange={(event) => setOrderForm((current) => ({ ...current, pickup_date: event.target.value }))}
                    />
                  </Form.Group>
                </Col>
                <Col md={5}>
                  <Form.Group>
                    <Form.Label>Ghi chú đơn</Form.Label>
                    <Form.Control
                      value={orderForm.notes}
                      onChange={(event) => setOrderForm((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <div className="panel-actions">
                <Button variant="outline-secondary" onClick={() => setStep(0)}>Quay lại</Button>
                <Button onClick={() => setStep(2)} disabled={!selectedCardType || !orderForm.quantity}>Tiếp tục</Button>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="app-panel">
          <h2>Xác nhận đơn</h2>
          <Row className="g-3">
            <Col md={6}>
              <div className="summary-box">
                <span>Khách hàng</span>
                <strong>{selectedCustomer?.full_name}</strong>
                <small>{selectedCustomer?.phone}</small>
              </div>
            </Col>
            <Col md={6}>
              <div className="summary-box">
                <span>Loại thẻ</span>
                <strong>{selectedCardType?.name}</strong>
                <small>{selectedCardType?.width_mm} x {selectedCardType?.height_mm} mm</small>
              </div>
            </Col>
            <Col md={4}>
              <div className="summary-box">
                <span>Số lượng</span>
                <strong>{orderForm.quantity}</strong>
              </div>
            </Col>
            <Col md={4}>
              <div className="summary-box">
                <span>Ngày hẹn</span>
                <strong>{orderForm.pickup_date || '-'}</strong>
              </div>
            </Col>
            <Col md={4}>
              <div className="summary-box">
                <span>Giá tạm tính</span>
                <strong>{formatCurrency(estimatedTotal)}</strong>
              </div>
            </Col>
          </Row>
          {createOrderMutation.error ? <Alert variant="danger" className="mt-3">{createOrderMutation.error.message}</Alert> : null}
          <div className="panel-actions">
            <Button variant="outline-secondary" onClick={() => setStep(1)}>Quay lại</Button>
            <Button onClick={submitOrder} disabled={createOrderMutation.isPending || !selectedCustomer || !selectedCardType}>
              {createOrderMutation.isPending ? 'Đang tạo đơn...' : 'Tạo đơn'}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

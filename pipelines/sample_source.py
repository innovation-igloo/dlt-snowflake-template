"""In-code sample source: a zero-dependency dlt source that yields rows in Python.

No external database, no network, no credentials. This is what lets the `sample`
pipeline run identically everywhere:

    make run    NAME=sample   # local DuckDB
    make run-sf NAME=sample   # laptop -> Snowflake
    make dev-run NAME=sample  # in-Snowflake SPCS job (no SECRET needed)

It lives under `pipelines/` (not `sources/`) on purpose: the SPCS Dockerfile copies
`pipelines/` into the image, so this source is baked in and available to the runner
inside the container.
"""

from __future__ import annotations

from typing import Any, Iterator

import dlt

_CUSTOMERS = [
    (1, "Alice Nguyen", "alice@example.com", "2024-01-01T09:00:00Z"),
    (2, "Bob Martinez", "bob@example.com", "2024-01-02T10:30:00Z"),
    (3, "Carol Idris", "carol@example.com", "2024-01-03T14:15:00Z"),
    (4, "Dan O'Neal", "dan@example.com", "2024-01-04T08:45:00Z"),
    (5, "Eve Zhang", "eve@example.com", "2024-01-05T16:20:00Z"),
]

_ORDERS = [
    (100, 1, "2024-01-06T11:00:00Z", 129.99, "shipped"),
    (101, 1, "2024-01-07T12:30:00Z", 19.50, "delivered"),
    (102, 2, "2024-01-07T09:10:00Z", 249.00, "processing"),
    (103, 3, "2024-01-08T15:45:00Z", 75.25, "shipped"),
    (104, 5, "2024-01-09T13:05:00Z", 42.00, "cancelled"),
]


@dlt.source(name="sample")
def sample_source(n_customers: int = 5, n_orders: int = 5) -> Any:
    """A dlt source with two deterministic tables (customers, orders).

    `n_customers` / `n_orders` cap the rows emitted (default: all 5 of each), so
    the registry `config` can shrink the sample without code changes.
    """

    @dlt.resource(name="customers", primary_key="id", write_disposition="merge")
    def customers() -> Iterator[dict[str, Any]]:
        for cid, name, email, updated_at in _CUSTOMERS[: max(0, n_customers)]:
            yield {"id": cid, "name": name, "email": email, "updated_at": updated_at}

    @dlt.resource(name="orders", primary_key="id", write_disposition="merge")
    def orders() -> Iterator[dict[str, Any]]:
        for oid, customer_id, ordered_at, amount, status in _ORDERS[: max(0, n_orders)]:
            yield {
                "id": oid,
                "customer_id": customer_id,
                "ordered_at": ordered_at,
                "amount": amount,
                "status": status,
            }

    return customers, orders

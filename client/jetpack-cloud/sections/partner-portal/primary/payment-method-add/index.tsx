/**
 * External dependencies
 */
import React, { ReactElement, useState, useMemo, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import page from 'page';
import { StripeHookProvider, useStripe } from '@automattic/calypso-stripe';
import { useTranslate } from 'i18n-calypso';
import { CheckoutProvider, CheckoutSubmitButton } from '@automattic/composite-checkout';
import { Button, Card } from '@automattic/components';

/**
 * Internal dependencies
 */
import Main from 'calypso/components/main';
import CardHeading from 'calypso/components/card-heading';
import DocumentHead from 'calypso/components/data/document-head';
import SidebarNavigation from 'calypso/jetpack-cloud/sections/partner-portal/sidebar-navigation';
import { useCreateStoredCreditCard } from 'calypso/jetpack-cloud/sections/partner-portal/payment-methods/hooks/use-create-stored-credit-card';
import { getCurrentUserLocale } from 'calypso/state/current-user/selectors';
import { getStripeConfiguration } from 'calypso/lib/store-transactions';
import getPaymentMethodIdFromPayment from 'calypso/jetpack-cloud/sections/partner-portal/payment-methods/get-payment-method-id-from-payment';
import Notice from 'calypso/components/notice';
import { errorNotice, infoNotice, successNotice } from 'calypso/state/notices/actions';
import { assignNewCardProcessor } from 'calypso/jetpack-cloud/sections/partner-portal/payment-methods/assignment-processor-functions';
import { creditCardHasAlreadyExpired } from 'calypso/lib/purchases';
import type { Purchase } from 'calypso/lib/purchases/types';
import type { TranslateResult } from 'i18n-calypso';
import FormInputCheckbox from 'calypso/components/forms/form-checkbox';
import FormLabel from 'calypso/components/forms/form-label';
import CreditCardLoading from 'calypso/jetpack-cloud/sections/partner-portal/credit-card-fields/credit-card-loading';

/**
 * Style dependencies
 */
import './style.scss';

function onPaymentSelectComplete( {
	successCallback,
	translate,
	showSuccessMessage,
	purchase,
}: {
	successCallback: () => void;
	translate: ReturnType< typeof useTranslate >;
	showSuccessMessage: ( message: string | TranslateResult ) => void;
	purchase?: Purchase | undefined;
} ) {
	if ( purchase ) {
		showSuccessMessage( translate( 'Your payment method has been set.' ) );
	} else {
		showSuccessMessage( translate( 'Your payment method has been added successfully.' ) );
	}
	successCallback();
}

function CurrentPaymentMethodNotAvailableNotice( {
	purchase,
}: {
	purchase: Purchase;
} ): JSX.Element | null {
	const translate = useTranslate();
	const moment = useLocalizedMoment();
	const noticeProps: Record< string, boolean | string | number | TranslateResult > = {
		showDismiss: false,
	};

	if ( purchase.payment.creditCard && creditCardHasAlreadyExpired( purchase ) ) {
		noticeProps.text = translate(
			'Your %(cardType)s ending in %(cardNumber)d expired %(cardExpiry)s.',
			{
				args: {
					cardType: purchase.payment.creditCard.type.toUpperCase(),
					cardNumber: parseInt( purchase.payment.creditCard.number, 10 ),
					cardExpiry: moment( purchase.payment.creditCard.expiryDate, 'MM/YY' ).format(
						'MMMM YYYY'
					),
				},
			}
		);
		return <Notice { ...noticeProps } />;
	}

	return null;
}

function PaymentMethodAdd(): ReactElement {
	const purchase = undefined;
	const reduxDispatch = useDispatch();
	const translate = useTranslate();
	const { isStripeLoading, stripeLoadingError, stripeConfiguration, stripe } = useStripe();

	const stripeMethod = useCreateStoredCreditCard( {
		isStripeLoading,
		stripeLoadingError,
		stripeConfiguration,
		stripe,
		activePayButtonText: translate( 'Save payment method' ) as string,
	} );
	const paymentMethods = useMemo( () => [ stripeMethod ].filter( Boolean ), [ stripeMethod ] );

	useEffect( () => {
		if ( stripeLoadingError ) {
			reduxDispatch( errorNotice( stripeLoadingError.message ) );
		}
	}, [ stripeLoadingError, reduxDispatch ] );

	const onGoToPaymentMethods = () => {
		// record tracks events
	};

	const currentlyAssignedPaymentMethodId = getPaymentMethodIdFromPayment( purchase?.payment );

	const showSuccessMessage = useCallback(
		( message ) => {
			reduxDispatch( successNotice( message, { displayOnNextPage: true, duration: 5000 } ) );
		},
		[ reduxDispatch ]
	);

	const showErrorMessage = useCallback(
		( error ) => {
			const message = error?.toString ? error.toString() : error;
			reduxDispatch( errorNotice( message, { displayOnNextPage: true } ) );
		},
		[ reduxDispatch ]
	);

	const showInfoMessage = useCallback(
		( message ) => {
			reduxDispatch( infoNotice( message ) );
		},
		[ reduxDispatch ]
	);

	const currentPaymentMethodNotAvailable = ! paymentMethods.some(
		( paymentMethod ) => paymentMethod?.id === currentlyAssignedPaymentMethodId
	);

	const [ useAsPrimaryPaymentMethod, setUseAsPrimaryPaymentMethod ] = useState< boolean >(
		! purchase
	);

	const assignAllSubscriptionsText = String( translate( 'Set as primary payment method' ) );

	return (
		<Main wideLayout className="payment-method-add">
			<DocumentHead title={ translate( 'Payment Method' ) } />
			<SidebarNavigation />

			<div className="payment-method-add__header">
				<CardHeading size={ 36 }>{ translate( 'Payment Method' ) }</CardHeading>
			</div>

			<CheckoutProvider
				onPaymentComplete={ () =>
					onPaymentSelectComplete( {
						successCallback: () => page( '/partner-portal/payment-method/' ),
						translate,
						showSuccessMessage,
						purchase,
					} )
				}
				showErrorMessage={ showErrorMessage }
				showInfoMessage={ showInfoMessage }
				showSuccessMessage={ showSuccessMessage }
				paymentMethods={ paymentMethods }
				paymentProcessors={ {
					card: ( data ) =>
						assignNewCardProcessor(
							{
								purchase,
								useAsPrimaryPaymentMethod,
								translate,
								stripe,
								stripeConfiguration,
								reduxDispatch,
							},
							data
						),
				} }
				isLoading={ isStripeLoading }
				initiallySelectedPaymentMethodId="card"
			>
				<Card className="payment-method-add__content">
					<CardHeading>{ translate( 'Credit card details' ) }</CardHeading>

					{ 0 === paymentMethods.length && <CreditCardLoading /> }

					{ currentPaymentMethodNotAvailable && purchase && (
						<CurrentPaymentMethodNotAvailableNotice purchase={ purchase } />
					) }

					{ paymentMethods && paymentMethods[ 0 ] && paymentMethods[ 0 ].activeContent }

					{ ! purchase && (
						<FormLabel className="payment-method-add__all-subscriptions-checkbox-label">
							<FormInputCheckbox
								className="payment-method-add__all-subscriptions-checkbox"
								checked={ useAsPrimaryPaymentMethod }
								onChange={ () => setUseAsPrimaryPaymentMethod( ( checked ) => ! checked ) }
								aria-label={ assignAllSubscriptionsText }
							/>
							<span>{ assignAllSubscriptionsText }</span>
						</FormLabel>
					) }

					<div className="payment-method-add__navigation-buttons">
						<Button
							className="payment-method-add__back-button"
							href="/partner-portal/payment-method/"
							disabled={ isStripeLoading }
							onClick={ onGoToPaymentMethods }
						>
							{ translate( 'Go back' ) }
						</Button>
						<CheckoutSubmitButton className="payment-method-add__submit-button" />
					</div>
				</Card>
			</CheckoutProvider>
		</Main>
	);
}

export default function PaymentMethodAddWrapper( props ) {
	const locale = useSelector( getCurrentUserLocale );

	return (
		<StripeHookProvider
			locale={ locale }
			configurationArgs={ { needs_intent: true } }
			fetchStripeConfiguration={ getStripeConfiguration }
		>
			<PaymentMethodAdd { ...props } />
		</StripeHookProvider>
	);
}

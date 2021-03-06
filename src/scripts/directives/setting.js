(function () {
    'use strict';

    angular.module('ariaNg').directive('ngSetting', ['$timeout', '$translate', 'ariaNgConstants', function ($timeout, $translate, ariaNgConstants) {
        return {
            restrict: 'E',
            templateUrl: 'views/setting.html',
            require: '?ngModel',
            replace: true,
            scope: {
                option: '=',
                ngModel: '=',
                defaultValue: '=?',
                onChangeValue: '&'
            },
            link: function (scope, element, attrs, ngModel) {
                var pendingSaveRequest = null;
                var options = {
                    lazySaveTimeout: ariaNgConstants.lazySaveTimeout,
                    errorTooltipDelay: ariaNgConstants.errorTooltipDelay
                };

                angular.extend(options, attrs);

                var destroyTooltip = function () {
                    angular.element(element).tooltip('destroy');
                };

                var showTooltip = function (cause, type, causeParams) {
                    if (!cause) {
                        return;
                    }

                    $timeout(function () {
                        var currentValue = scope.optionStatus.getValue();

                        if (currentValue !== 'failed' && currentValue !== 'error') {
                            return;
                        }

                        angular.element(element).tooltip({
                            title: $translate.instant(cause, causeParams),
                            trigger: 'focus',
                            placement: 'auto top',
                            container: element,
                            template:
                            '<div class="tooltip' + (type ? ' tooltip-' + type : '') + '" role="tooltip">' +
                                '<div class="tooltip-arrow"></div>' +
                                '<div class="tooltip-inner"></div>' +
                            '</div>'
                        }).tooltip('show');
                    }, options.errorTooltipDelay);
                };

                scope.optionStatus = (function () {
                    var value = 'ready';

                    return {
                        getValue: function () {
                            return value;
                        },
                        setReady: function () {
                            destroyTooltip();
                            value = 'ready';
                        },
                        setPending: function () {
                            destroyTooltip();
                            value = 'pending';
                        },
                        setSaving: function () {
                            destroyTooltip();
                            value = 'pending';
                        },
                        setSuccess: function () {
                            destroyTooltip();
                            value = 'success';
                        },
                        setFailed: function (cause) {
                            destroyTooltip();
                            value = 'failed';
                            showTooltip(cause, 'warning');
                        },
                        setError: function (cause, causeParams) {
                            destroyTooltip();
                            value = 'error';
                            showTooltip(cause, 'error', causeParams);
                        },
                        getStatusFeedbackStyle: function () {
                            if (value === 'success') {
                                return 'has-success';
                            } else if (value === 'failed') {
                                return 'has-warning';
                            } else if (value === 'error') {
                                return 'has-error';
                            } else {
                                return '';
                            }
                        },
                        getStatusIcon: function () {
                            if (value === 'pending') {
                                return 'fa-hourglass-start';
                            } else if (value === 'saving') {
                                return 'fa-spin fa-pulse fa-spinner';
                            } else if (value === 'success') {
                                return 'fa-check';
                            } else if (value === 'failed') {
                                return 'fa-exclamation';
                            } else if (value === 'error') {
                                return 'fa-times';
                            } else {
                                return '';
                            }
                        },
                        isShowStatusIcon: function () {
                            return this.getStatusIcon() !== '';
                        }
                    };
                })();

                scope.getTotalCount = function () {
                    if (!scope.optionValue && !angular.isString(scope.optionValue)) {
                        return 0;
                    }

                    return scope.optionValue.split(scope.option.split).length;
                };

                scope.changeValue = function (optionValue, lazySave) {
                    if (pendingSaveRequest) {
                        $timeout.cancel(pendingSaveRequest);
                    }

                    scope.optionValue = optionValue;
                    scope.optionStatus.setReady();

                    if (!scope.option || !scope.option.key || scope.option.readonly) {
                        return;
                    }

                    if (scope.option.required && optionValue === '') {
                        scope.optionStatus.setError('Option value cannot be empty!');
                        return;
                    }

                    if (scope.option.type === 'integer' && !/^-?\d+$/.test(optionValue)) {
                        scope.optionStatus.setError('Input number is invalid!');
                        return;
                    }

                    if (scope.option.type === 'float' && !/^-?(\d*\.)?\d+$/.test(optionValue)) {
                        scope.optionStatus.setError('Input number is invalid!');
                        return;
                    }

                    if ((scope.option.type === 'integer' || scope.option.type === 'float') && (angular.isDefined(scope.option.min) || angular.isDefined(scope.option.max))) {
                        var number = optionValue;

                        if (scope.option.type === 'integer') {
                            number = parseInt(optionValue);
                        } else if (scope.option.type === 'float') {
                            number = parseFloat(optionValue);
                        }

                        if (angular.isDefined(scope.option.min) && number < scope.option.min) {
                            scope.optionStatus.setError('Input number is below min value!', { value: scope.option.min });
                            return;
                        }

                        if (angular.isDefined(scope.option.max) && number > scope.option.max) {
                            scope.optionStatus.setError('Input number is above max value!', { value: scope.option.max });
                            return;
                        }
                    }

                    if (angular.isDefined(scope.option.pattern) && !(new RegExp(scope.option.pattern).test(optionValue))) {
                        scope.optionStatus.setError('Input value is invalid!');
                        return;
                    }

                    var data = {
                        key: scope.option.key,
                        value: optionValue,
                        optionStatus: scope.optionStatus
                    };

                    var invokeChange = function () {
                        scope.optionStatus.setSaving();
                        scope.onChangeValue(data);
                    };

                    if (scope.onChangeValue) {
                        if (lazySave) {
                            scope.optionStatus.setPending();

                            pendingSaveRequest = $timeout(function () {
                                invokeChange();
                            }, options.lazySaveTimeout);
                        } else {
                            invokeChange();
                        }
                    }
                };

                if (ngModel) {
                    scope.$watch(function () {
                        return ngModel.$viewValue;
                    }, function (value) {
                        scope.optionValue = value;
                    });
                }

                scope.$watch('option', function () {
                    element.find('[data-toggle="popover"]').popover();
                });

                scope.$watch('defaultValue', function (value) {
                    var displayValue = value;

                    if (scope.option && scope.option.options) {
                        for (var i = 0; i < scope.option.options.length; i++) {
                            var optionItem = scope.option.options[i];

                            if (optionItem.value === value) {
                                displayValue = optionItem.name;
                                break;
                            }
                        }
                    }

                    scope.placeholder = displayValue;
                });
            }
        };
    }]);
}());
